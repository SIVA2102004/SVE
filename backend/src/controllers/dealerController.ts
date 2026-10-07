import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

export const getDealers = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { companyName: { contains: String(search) } },
        { mobile: { contains: String(search) } },
      ];
    }

    const dealers = await prisma.dealer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        payables: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });

    const normalized = dealers.map((d) => ({
      ...d,
      phone: d.mobile,
      mobile: d.mobile,
      totalPayable: d.totalBilled,
      totalPaid: d.totalPaid,
      gstin: d.gstNumber,
    }));

    res.json(normalized);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDealer = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      companyName,
      contactPerson,
      mobile,
      phone,
      email,
      address,
      gstNumber,
      gstin,
      paymentTerms,
      notes,
      initialPayableInvoice,
      initialPayableAmountRupees,
      dueDate,
    } = req.body;

    const resolvedMobile = mobile || phone;
    const resolvedCompany = companyName || name;
    const resolvedContact = contactPerson || name;
    const resolvedGst = gstNumber || gstin;

    if (!name || !resolvedMobile) {
      return res.status(400).json({ success: false, message: 'Dealer name and mobile number are required.' });
    }

    const initialPaise = initialPayableAmountRupees ? rupeesToPaise(initialPayableAmountRupees) : 0;

    const dealer = await prisma.$transaction(async (tx) => {
      const newDealer = await tx.dealer.create({
        data: {
          name,
          companyName: resolvedCompany,
          mobile: resolvedMobile,
          email: email || null,
          address: address || null,
          gstNumber: resolvedGst || null,
          paymentTerms: paymentTerms || null,
          notes: notes || null,
          totalBilled: initialPaise,
          totalPaid: 0,
          pendingBalance: initialPaise,
        },
      });

      if (initialPaise > 0) {
        await tx.payable.create({
          data: {
            dealerId: newDealer.id,
            invoiceNumber: initialPayableInvoice || `PUR-${Date.now().toString().slice(-4)}`,
            totalAmount: initialPaise,
            paidAmount: 0,
            pendingAmount: initialPaise,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: 'PENDING',
            notes: 'Opening purchase payable balance',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'DEALER_CREATED',
          entityType: 'DEALER',
          entityId: newDealer.id,
          amount: initialPaise,
          details: JSON.stringify({ companyName, mobile }),
        },
      });

      return newDealer;
    });

    broadcastEvent('dealer_updated', { dealerId: dealer.id });
    res.status(201).json({ success: true, dealer });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createDealerPayable = async (req: AuthRequest, res: Response) => {
  try {
    const { dealerId } = req.params;
    const { invoiceNumber, totalAmountRupees, purchaseDate, dueDate, notes } = req.body;

    const amountPaise = rupeesToPaise(totalAmountRupees);
    if (amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Purchase amount must be greater than zero.' });
    }

    const payable = await prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
      if (!dealer) throw new Error('Dealer not found');

      const invNo = invoiceNumber || `PUR-${Date.now().toString().slice(-4)}`;

      const newPayable = await tx.payable.create({
        data: {
          dealerId,
          invoiceNumber: invNo,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          totalAmount: amountPaise,
          paidAmount: 0,
          pendingAmount: amountPaise,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'PENDING',
          notes: notes || null,
        },
      });

      await tx.dealer.update({
        where: { id: dealerId },
        data: {
          totalBilled: dealer.totalBilled + amountPaise,
          pendingBalance: dealer.pendingBalance + amountPaise,
        },
      });

      return newPayable;
    });

    broadcastEvent('payable_created', { dealerId, payableId: payable.id });
    res.status(201).json({ success: true, payable });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Record payment to dealer (Atomic DB Transaction)
 */
export const payDealer = async (req: AuthRequest, res: Response) => {
  try {
    const { dealerId } = req.params;
    const {
      amountRupees,
      paymentMethod = 'BANK_TRANSFER',
      paymentMethodAccountId,
      payableId,
      notes,
      idempotencyKey,
    } = req.body;

    const payPaise = rupeesToPaise(amountRupees);
    if (payPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    // Idempotency check
    if (idempotencyKey) {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return res.json({ success: true, message: 'Payment already processed (idempotent)', payment: existing });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.findUnique({ where: { id: dealerId } });
      if (!dealer) throw new Error('Dealer not found');

      // 1. Generate receipt number
      const count = await tx.payment.count();
      const receiptNumber = `PAY-${String(count + 1001).padStart(5, '0')}`;

      // 2. Resolve target payable
      let targetPayableId = payableId;
      if (!targetPayableId) {
        const oldestPending = await tx.payable.findFirst({
          where: { dealerId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
          orderBy: { createdAt: 'asc' },
        });
        if (oldestPending) targetPayableId = oldestPending.id;
      }

      // 3. Create Payment record
      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          type: 'DEALER_EXPENSE',
          amount: payPaise,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          dealerId,
          payableId: targetPayableId || null,
          notes,
          idempotencyKey: idempotencyKey || null,
          createdById: req.user!.id,
        },
      });

      // 4. Create financial transaction
      const transaction = await tx.transaction.create({
        data: {
          type: 'PAYABLE_PAYMENT',
          category: 'Dealer Payment',
          amount: payPaise,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: 'Shop Account',
          destination: dealer.companyName,
          reference: receiptNumber,
          description: `Paid to dealer ${dealer.companyName} (${dealer.name})${notes ? ` - ${notes}` : ''}`,
          paymentId: payment.id,
          createdById: req.user!.id,
        },
      });

      // 5. Update Dealer running balances
      const newPaid = dealer.totalPaid + payPaise;
      const newPending = Math.max(0, dealer.pendingBalance - payPaise);
      await tx.dealer.update({
        where: { id: dealerId },
        data: { totalPaid: newPaid, pendingBalance: newPending },
      });

      // 6. Update Payable if attached
      if (targetPayableId) {
        const p = await tx.payable.findUnique({ where: { id: targetPayableId } });
        if (p) {
          const pNewPaid = p.paidAmount + payPaise;
          const pNewPending = Math.max(0, p.pendingAmount - payPaise);
          const pStatus = pNewPending === 0 ? 'PAID' : 'PARTIALLY_PAID';

          await tx.payable.update({
            where: { id: targetPayableId },
            data: { paidAmount: pNewPaid, pendingAmount: pNewPending, status: pStatus },
          });
        }
      }

      // 7. Deduct from Payment Account balance
      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { decrement: payPaise } },
        });
      }

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'PAYMENT_CREATED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          amount: payPaise,
          transactionId: transaction.id,
          details: JSON.stringify({ dealer: dealer.companyName, receiptNumber, paymentMethod }),
        },
      });

      return { payment, transaction, receiptNumber };
    });

    broadcastEvent('payment_recorded', {
      type: 'DEALER_PAYMENT',
      amount: payPaise,
      receiptNumber: result.receiptNumber,
    });

    res.status(201).json({
      success: true,
      message: 'Dealer payment recorded successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateDealer = async (req: AuthRequest, res: Response) => {
  try {
    const { dealerId } = req.params;
    const { name, companyName, mobile, phone, email, address, gstNumber, gstin, notes, pendingBalanceRupees } = req.body;

    const existingDealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
    if (!existingDealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const resolvedMobile = mobile || phone || existingDealer.mobile;
    const resolvedCompany = companyName || name || existingDealer.companyName;
    const resolvedGst = gstNumber || gstin !== undefined ? (gstNumber || gstin) : existingDealer.gstNumber;

    const updateData: any = {
      name: name || existingDealer.name,
      companyName: resolvedCompany,
      mobile: resolvedMobile,
      email: email !== undefined ? email : existingDealer.email,
      address: address !== undefined ? address : existingDealer.address,
      gstNumber: resolvedGst || null,
      notes: notes !== undefined ? notes : existingDealer.notes,
    };

    // If owner/manager wants to directly correct/adjust the pending balance amount
    if (pendingBalanceRupees !== undefined && pendingBalanceRupees !== null) {
      const newPendingPaise = rupeesToPaise(pendingBalanceRupees);
      updateData.pendingBalance = newPendingPaise;
      updateData.totalBilled = existingDealer.totalPaid + newPendingPaise;

      // Also update the latest pending payable record if one exists, or create an adjustment payable
      const pendingPayable = await prisma.payable.findFirst({
        where: { dealerId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingPayable) {
        await prisma.payable.update({
          where: { id: pendingPayable.id },
          data: {
            totalAmount: newPendingPaise,
            pendingAmount: newPendingPaise,
          },
        });
      }
    }

    const updated = await prisma.dealer.update({
      where: { id: dealerId },
      data: updateData,
    });

    broadcastEvent('dealer_updated', { dealerId: updated.id });
    res.json({ success: true, message: 'Dealer updated successfully', dealer: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update dealer' });
  }
};

export const deleteDealer = async (req: AuthRequest, res: Response) => {
  try {
    const { dealerId } = req.params;
    const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    // Cascade delete dealer records
    await prisma.$transaction(async (tx) => {
      await tx.payable.deleteMany({ where: { dealerId } });
      await tx.payment.deleteMany({ where: { dealerId } });
      await tx.dealer.delete({ where: { id: dealerId } });
    });

    broadcastEvent('dealer_updated', { dealerId });
    res.json({ success: true, message: `Dealer "${dealer.name}" deleted successfully` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete dealer' });
  }
};


import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status } = req.query;
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = String(status);
    }

    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { mobile: { contains: String(search) } },
        { address: { contains: String(search) } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        receivables: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });

    const normalized = customers.map((c) => ({
      ...c,
      phone: c.mobile,
      mobile: c.mobile,
      totalReceivable: c.totalBilled,
      totalReceived: c.totalPaid,
    }));

    res.json(normalized);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mobile, phone, email, address, notes, initialReceivableInvoice, initialReceivableAmountRupees, dueDate } =
      req.body;
    const resolvedMobile = mobile || phone;

    if (!name || !resolvedMobile) {
      return res.status(400).json({ success: false, message: 'Customer name and phone number are required.' });
    }

    const initialPaise = initialReceivableAmountRupees ? rupeesToPaise(initialReceivableAmountRupees) : 0;

    const customer = await prisma.$transaction(async (tx) => {
      const newCust = await tx.customer.create({
        data: {
          name,
          mobile: resolvedMobile,
          email: email || null,
          address: address || null,
          notes: notes || null,
          totalBilled: initialPaise,
          totalPaid: 0,
          pendingBalance: initialPaise,
        },
      });

      if (initialPaise > 0) {
        await tx.receivable.create({
          data: {
            customerId: newCust.id,
            invoiceNumber: initialReceivableInvoice || `INV-${Date.now().toString().slice(-4)}`,
            totalAmount: initialPaise,
            paidAmount: 0,
            pendingAmount: initialPaise,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: 'PENDING',
            notes: 'Opening receivable balance',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'CUSTOMER_CREATED',
          entityType: 'CUSTOMER',
          entityId: newCust.id,
          amount: initialPaise,
          details: JSON.stringify({ name, mobile }),
        },
      });

      return newCust;
    });

    broadcastEvent('customer_updated', { customerId: customer.id });
    res.status(201).json({ success: true, customer });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createCustomerReceivable = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const { invoiceNumber, totalAmountRupees, dueDate, notes } = req.body;

    const amountPaise = rupeesToPaise(totalAmountRupees);
    if (amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice amount must be greater than zero.' });
    }

    const receivable = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new Error('Customer not found');

      const invNo = invoiceNumber || `INV-${Date.now().toString().slice(-4)}`;

      const newRec = await tx.receivable.create({
        data: {
          customerId,
          invoiceNumber: invNo,
          totalAmount: amountPaise,
          paidAmount: 0,
          pendingAmount: amountPaise,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'PENDING',
          notes: notes || null,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalBilled: customer.totalBilled + amountPaise,
          pendingBalance: customer.pendingBalance + amountPaise,
        },
      });

      return newRec;
    });

    broadcastEvent('receivable_created', { customerId, receivableId: receivable.id });
    res.status(201).json({ success: true, receivable });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Record payment received from customer (Atomic DB Transaction)
 */
export const recordCustomerPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      amountRupees,
      paymentMethod = 'CASH',
      paymentMethodAccountId,
      receivableId,
      notes,
      idempotencyKey,
    } = req.body;

    const payPaise = rupeesToPaise(amountRupees);
    if (payPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    // Idempotency check to prevent duplicate payment submissions
    if (idempotencyKey) {
      const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
      if (existing) {
        return res.json({ success: true, message: 'Payment already processed (idempotent)', payment: existing });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new Error('Customer not found');

      // 1. Generate receipt number
      const count = await tx.payment.count();
      const receiptNumber = `REC-${String(count + 1001).padStart(5, '0')}`;

      // 2. Resolve target receivable
      let targetRecId = receivableId;
      if (!targetRecId) {
        const oldestPending = await tx.receivable.findFirst({
          where: { customerId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
          orderBy: { createdAt: 'asc' },
        });
        if (oldestPending) targetRecId = oldestPending.id;
      }

      // 3. Create Payment record
      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          type: 'CUSTOMER_INCOME',
          amount: payPaise,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          customerId,
          receivableId: targetRecId || null,
          notes,
          idempotencyKey: idempotencyKey || null,
          createdById: req.user!.id,
        },
      });

      // 4. Create financial transaction
      const transaction = await tx.transaction.create({
        data: {
          type: 'RECEIVABLE_PAYMENT',
          category: 'Customer Payment',
          amount: payPaise,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: customer.name,
          destination: 'Shop Account',
          reference: receiptNumber,
          description: `Payment received from customer ${customer.name}${notes ? ` - ${notes}` : ''}`,
          paymentId: payment.id,
          createdById: req.user!.id,
        },
      });

      // 5. Update Customer running balances
      const newPaid = customer.totalPaid + payPaise;
      const newPending = Math.max(0, customer.pendingBalance - payPaise);
      await tx.customer.update({
        where: { id: customerId },
        data: { totalPaid: newPaid, pendingBalance: newPending },
      });

      // 6. Update Receivable if attached
      if (targetRecId) {
        const rec = await tx.receivable.findUnique({ where: { id: targetRecId } });
        if (rec) {
          const recNewPaid = rec.paidAmount + payPaise;
          const recNewPending = Math.max(0, rec.pendingAmount - payPaise);
          const recStatus = recNewPending === 0 ? 'PAID' : 'PARTIALLY_PAID';

          await tx.receivable.update({
            where: { id: targetRecId },
            data: { paidAmount: recNewPaid, pendingAmount: recNewPending, status: recStatus },
          });
        }
      }

      // 7. Increment Payment Account balance
      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { increment: payPaise } },
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
          details: JSON.stringify({ customer: customer.name, receiptNumber, paymentMethod }),
        },
      });

      return { payment, transaction, receiptNumber };
    });

    broadcastEvent('payment_recorded', {
      type: 'CUSTOMER_PAYMENT',
      amount: payPaise,
      receiptNumber: result.receiptNumber,
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded and balance updated successfully',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const { name, mobile, phone, email, address, notes, pendingBalanceRupees } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const resolvedMobile = mobile || phone || existing.mobile;
    const updateData: any = {
      name: name || existing.name,
      mobile: resolvedMobile,
      email: email !== undefined ? email : existing.email,
      address: address !== undefined ? address : existing.address,
      notes: notes !== undefined ? notes : existing.notes,
    };

    if (pendingBalanceRupees !== undefined && pendingBalanceRupees !== null) {
      const newPendingPaise = rupeesToPaise(pendingBalanceRupees);
      updateData.pendingBalance = newPendingPaise;
      updateData.totalBilled = existing.totalPaid + newPendingPaise;

      const pendingRec = await prisma.receivable.findFirst({
        where: { customerId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingRec) {
        await prisma.receivable.update({
          where: { id: pendingRec.id },
          data: {
            totalAmount: newPendingPaise,
            pendingAmount: newPendingPaise,
          },
        });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    broadcastEvent('customer_updated', { customerId: updated.id });
    res.json({ success: true, message: 'Customer updated successfully', customer: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update customer' });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.receivable.deleteMany({ where: { customerId } });
      await tx.payment.deleteMany({ where: { customerId } });
      await tx.customer.delete({ where: { id: customerId } });
    });

    broadcastEvent('customer_updated', { customerId });
    res.json({ success: true, message: `Customer "${customer.name}" deleted successfully` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete customer' });
  }
};


import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ShopFlow business accounts, customers, dealers, staff and ledgers...');

  // 1. Clear existing records for clean seed
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.receivable.deleteMany();
  await prisma.payable.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.loanInstallment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.salaryRecord.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.dealer.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.paymentMethodAccount.deleteMany();
  await prisma.shopSettings.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users with Role-Based Access Control
  const passwordHash = await bcrypt.hash('ShopFlow@123', 10);

  const owner = await prisma.user.create({
    data: {
      username: 'owner',
      email: 'owner@shopflow.in',
      name: 'Rajesh Sharma (Owner)',
      phone: '+91 98765 43210',
      passwordHash,
      role: 'OWNER',
    },
  });

  const manager = await prisma.user.create({
    data: {
      username: 'manager',
      email: 'manager@shopflow.in',
      name: 'Vikram Singh (Store Manager)',
      phone: '+91 98765 11111',
      passwordHash,
      role: 'MANAGER',
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      username: 'staff',
      email: 'staff@shopflow.in',
      name: 'Ravi Kumar (Counter Sales)',
      phone: '+91 98765 22222',
      passwordHash,
      role: 'STAFF',
    },
  });

  // 3. Create Shop Settings
  await prisma.shopSettings.create({
    data: {
      shopName: 'Sri Balaji Auto Spare Parts & Hardware',
      tagline: 'Retail, Wholesale & Genuine OEM Spares',
      address: 'Shop #14, Main Road, Market Yard, Bengaluru - 560002',
      phone: '+91 98765 43210',
      email: 'contact@shopflow.in',
      gstNumber: '29ABCDE1234F1Z5',
      currency: 'INR',
      currencySymbol: '₹',
      openingBalance: 30000000, // ₹3,00,000 opening cash
      receiptPrefix: 'REC-',
      invoicePrefix: 'INV-',
    },
  });

  // 4. Create Payment Method Accounts
  const cashRegister = await prisma.paymentMethodAccount.create({
    data: {
      name: 'Cash Register / Till',
      type: 'CASH',
      openingBalance: 8500000, // ₹85,000
      currentBalance: 8500000,
      isDefault: true,
    },
  });

  const bankAccount = await prisma.paymentMethodAccount.create({
    data: {
      name: 'SBI Current Account',
      type: 'BANK',
      bankName: 'State Bank of India',
      accountNumber: '9842517823',
      openingBalance: 32000000, // ₹3,20,000
      currentBalance: 32000000,
    },
  });

  const upiAccount = await prisma.paymentMethodAccount.create({
    data: {
      name: 'PhonePe / GPay Merchant QR',
      type: 'UPI',
      openingBalance: 8000000, // ₹80,000
      currentBalance: 8000000,
    },
  });

  // 5. Create Customers & Receivables (Workflow 1: Ramesh owes ₹50k, paid ₹20k, pending ₹30k)
  const custRamesh = await prisma.customer.create({
    data: {
      name: 'Ramesh Garage & Services',
      mobile: '+91 94441 23456',
      address: 'Workshop #4, Industrial Area',
      totalBilled: 5000000, // ₹50,000
      totalPaid: 2000000,   // ₹20,000
      pendingBalance: 3000000, // ₹30,000
    },
  });

  const recRamesh = await prisma.receivable.create({
    data: {
      customerId: custRamesh.id,
      invoiceNumber: 'INV-1025',
      totalAmount: 5000000,
      paidAmount: 2000000,
      pendingAmount: 3000000,
      dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // in 8 days
      status: 'PARTIALLY_PAID',
      notes: 'Brake pads, clutch plates, engine oil batch',
    },
  });

  const custMahesh = await prisma.customer.create({
    data: {
      name: 'Mahesh Fleet Operator',
      mobile: '+91 97772 34567',
      address: 'Ring Road Logistics Hub',
      totalBilled: 9000000,
      totalPaid: 0,
      pendingBalance: 9000000, // ₹90,000
    },
  });

  await prisma.receivable.create({
    data: {
      customerId: custMahesh.id,
      invoiceNumber: 'INV-1028',
      totalAmount: 9000000,
      paidAmount: 0,
      pendingAmount: 9000000,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      notes: 'Heavy commercial vehicle filters',
    },
  });

  // 6. Create Dealers & Payables (Workflow 2: XYZ Bearings owes ₹1,20,000, paid ₹50,000, pending ₹70,000)
  const dealerXYZ = await prisma.dealer.create({
    data: {
      name: 'Suresh Agarwal',
      companyName: 'XYZ Bearings Pvt Ltd',
      mobile: '+91 98883 45678',
      gstNumber: '29XYZAB9876C1Z4',
      paymentTerms: 'Net 30',
      totalBilled: 12000000, // ₹1,20,000
      totalPaid: 5000000,    // ₹50,000
      pendingBalance: 7000000, // ₹70,000
    },
  });

  const payXYZ = await prisma.payable.create({
    data: {
      dealerId: dealerXYZ.id,
      invoiceNumber: 'PUR-1005',
      totalAmount: 12000000,
      paidAmount: 5000000,
      pendingAmount: 7000000,
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      status: 'PARTIALLY_PAID',
      notes: 'Ball bearings & needle bearing sets',
    },
  });

  const dealerLubricants = await prisma.dealer.create({
    data: {
      name: 'Prakash Oils',
      companyName: 'Castrol Regional Wholesaler',
      mobile: '+91 99112 33445',
      gstNumber: '29CASOL5544B1Z9',
      paymentTerms: 'Weekly Settlement',
      totalBilled: 1500000,
      totalPaid: 0,
      pendingBalance: 1500000, // ₹15,000
    },
  });

  await prisma.payable.create({
    data: {
      dealerId: dealerLubricants.id,
      invoiceNumber: 'PUR-1009',
      totalAmount: 1500000,
      paidAmount: 0,
      pendingAmount: 1500000,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      notes: 'Synthetic 4T 20W40 oil barrels',
    },
  });

  // 7. Create Staff Members (Workflow 3: Ravi salary ₹20,000, attendance proration)
  const staffRavi = await prisma.staff.create({
    data: {
      name: 'Ravi Kumar',
      mobile: '+91 98765 22222',
      salaryType: 'MONTHLY',
      monthlySalary: 2000000, // ₹20,000
      joiningDate: new Date('2025-06-01'),
      status: 'ACTIVE',
      notes: 'Counter sales & parts dispatch specialist',
    },
  });

  const staffSuresh = await prisma.staff.create({
    data: {
      name: 'Suresh Gowda',
      mobile: '+91 98765 33333',
      salaryType: 'MONTHLY',
      monthlySalary: 1800000, // ₹18,000
      joiningDate: new Date('2025-08-15'),
      status: 'ACTIVE',
    },
  });

  // Seed attendance for current month
  const now = new Date();
  for (let d = 1; d <= Math.min(now.getDate(), 20); d++) {
    const attDate = new Date(now.getFullYear(), now.getMonth(), d);
    await prisma.attendance.create({
      data: {
        staffId: staffRavi.id,
        date: attDate,
        status: d % 7 === 0 ? 'HOLIDAY' : d === 4 ? 'ABSENT' : 'PRESENT',
      },
    });
  }

  // 8. Create Loans & Amortization Schedule
  const loan1 = await prisma.loan.create({
    data: {
      loanName: 'Store Inventory Expansion Loan',
      lender: 'HDFC Bank',
      principalAmount: 100000000, // ₹10,00,000
      interestRate: 10.5,
      tenureMonths: 36,
      emiAmount: 3250000, // ₹32,500
      startDate: new Date('2025-11-01'),
      nextEmiDate: new Date(now.getFullYear(), now.getMonth(), 10),
      remainingAmount: 72000000, // ₹7,20,000
      accountNumberMasked: 'HDFC-****-8842',
      status: 'ACTIVE',
    },
  });

  for (let i = 1; i <= 36; i++) {
    const dueDate = new Date('2025-11-01');
    dueDate.setMonth(dueDate.getMonth() + i);
    const isPast = i <= 8;

    await prisma.loanInstallment.create({
      data: {
        loanId: loan1.id,
        installmentNumber: i,
        dueDate,
        emiAmount: 3250000,
        principalComponent: 2500000,
        interestComponent: 750000,
        remainingPrincipal: Math.max(0, 100000000 - i * 2500000),
        status: isPast ? 'PAID' : 'PENDING',
        paidDate: isPast ? dueDate : null,
      },
    });
  }

  // 9. Insurance Policies
  await prisma.insurancePolicy.create({
    data: {
      insuranceType: 'Shop Insurance',
      policyName: 'Standard Fire & Special Perils Policy',
      company: 'ICICI Lombard General Insurance',
      policyNumber: 'ICICI-SF-99421-2026',
      premiumAmount: 1250000, // ₹12,500
      frequency: 'YEARLY',
      startDate: new Date('2026-01-15'),
      expiryDate: new Date('2027-01-14'),
      status: 'ACTIVE',
    },
  });

  // 10. Financial Transactions
  await prisma.transaction.createMany({
    data: [
      {
        type: 'INCOME',
        category: 'Cash Sales',
        amount: 2500000, // ₹25,000
        paymentMethod: 'CASH',
        paymentMethodAccountId: cashRegister.id,
        source: 'Counter Retail',
        destination: 'Cash Register',
        reference: 'REC-1001',
        description: 'Morning counter spare parts retail sales',
        createdById: owner.id,
      },
      {
        type: 'RECEIVABLE_PAYMENT',
        category: 'Customer Payment',
        amount: 2000000, // ₹20,000
        paymentMethod: 'UPI',
        paymentMethodAccountId: upiAccount.id,
        source: custRamesh.name,
        destination: 'Shop Account',
        reference: 'REC-1002',
        description: 'Partial payment on INV-1025 received via UPI',
        createdById: manager.id,
      },
      {
        type: 'PAYABLE_PAYMENT',
        category: 'Dealer Payment',
        amount: 5000000, // ₹50,000
        paymentMethod: 'BANK_TRANSFER',
        paymentMethodAccountId: bankAccount.id,
        source: 'Shop Account',
        destination: dealerXYZ.companyName,
        reference: 'PAY-1001',
        description: 'NEFT installment for PUR-1005 to XYZ Bearings',
        createdById: owner.id,
      },
      {
        type: 'EXPENSE',
        category: 'Electricity',
        amount: 350000, // ₹3,500
        paymentMethod: 'BANK_TRANSFER',
        paymentMethodAccountId: bankAccount.id,
        source: 'Shop Account',
        destination: 'City Electricity Board',
        reference: 'EXP-1001',
        description: 'Commercial 3-phase power bill for September',
        createdById: manager.id,
      },
    ],
  });

  // 11. Reminders
  await prisma.reminder.createMany({
    data: [
      {
        title: 'HDFC Mudra Loan Monthly EMI',
        description: '₹32,500 scheduled bank auto-debit',
        dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
        amount: 3250000,
        type: 'EMI_DUE',
      },
      {
        title: 'Castrol Lubricants Weekly Settlement',
        description: '₹15,000 due for oil drum shipment',
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2),
        amount: 1500000,
        type: 'DEALER_DUE',
      },
      {
        title: 'Collect Balance from Ramesh Garage',
        description: '₹30,000 pending on INV-1025',
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8),
        amount: 3000000,
        type: 'CUSTOMER_DUE',
      },
    ],
  });

  console.log('✅ ShopFlow database seeded successfully:');
  console.log('   👑 Owner:   username="owner"   | email="owner@shopflow.in"   | password="ShopFlow@123"');
  console.log('   👔 Manager: username="manager" | email="manager@shopflow.in" | password="ShopFlow@123"');
  console.log('   👷 Staff:   username="staff"   | email="staff@shopflow.in"   | password="ShopFlow@123"');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

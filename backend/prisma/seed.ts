import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging all demo data for clean production launch of SVE...');

  // 1. Delete transactional records in correct dependency order
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
  await prisma.documentReceipt.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // 2. Reset / Initialize Clean Payment Method Accounts (Ready with 0 Balance)
  await prisma.paymentMethodAccount.deleteMany();

  await prisma.paymentMethodAccount.create({
    data: {
      name: 'Cash in Register',
      type: 'CASH',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.paymentMethodAccount.create({
    data: {
      name: 'Bank Current Account',
      type: 'BANK',
      bankName: 'Primary Bank',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: false,
      isActive: true,
    },
  });

  await prisma.paymentMethodAccount.create({
    data: {
      name: 'Shop UPI / QR',
      type: 'UPI',
      openingBalance: 0,
      currentBalance: 0,
      isDefault: false,
      isActive: true,
    },
  });

  // 3. Reset Shop Settings to SVE with default Company Access Code
  await prisma.shopSettings.deleteMany();

  await prisma.shopSettings.create({
    data: {
      shopName: 'SVE Store',
      tagline: 'Automotive Spare Parts & Retail Finance',
      address: 'Shop #1, Main Market',
      phone: '+91 98765 43210',
      email: 'contact@sve.in',
      gstNumber: '29ABCDE1234F1Z5',
      currency: 'INR',
      currencySymbol: '₹',
      openingBalance: 0,
      receiptPrefix: 'SVE-REC-',
      invoicePrefix: 'SVE-INV-',
      accessCode: 'SVE-2026',
    },
  });

  console.log('✅ Clean reset complete!');
  console.log('   🏢 Company Name: SVE Store');
  console.log('   🔑 Company Access Code: SVE-2026');
  console.log('   👤 Users: Ready for Owner self-registration on first launch!');
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

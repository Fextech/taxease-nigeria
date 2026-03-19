import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Admin User...');

  const adminEmail = 'flowiselabs@gmail.com';
  const adminPassword = 'AutoMatic@247';

  // Check if admin already exists
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('Admin user already exists. Skipping...');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  // Create a TOTP secret
  const secret = new OTPAuth.Secret({ size: 20 });
  const totpSecret = secret.base32;

  const admin = await prisma.adminUser.create({
    data: {
      email: adminEmail,
      passwordHash,
      fullName: 'System Admin',
      role: 'SUPER_ADMIN',
      totpSecret,
      totpEnrolled: true,
      isActive: true,
    },
  });

  console.log(`Successfully created admin user: ${admin.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log(`TOTP Secret (Base32): ${totpSecret}`);
  
  const totp = new OTPAuth.TOTP({
    issuer: 'BankLens',
    label: admin.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });
  const uri = totp.toString();
  console.log(`\nImport into Authenticator App using this URI:`);
  console.log(uri);
  console.log(`\nOr generate a code now with: \nnode -e "console.log(require('otpauth').TOTP.generate({ secret: '${totpSecret}' }))"\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

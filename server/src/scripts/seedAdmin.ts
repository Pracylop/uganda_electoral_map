import prisma from '../config/database';
import { hashPassword } from '../utils/auth';

async function seedAdmin() {
  try {
    console.log('Creating initial admin user...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('✓ Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await hashPassword('admin123');

    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: hashedPassword,
        fullName: 'System Administrator',
        role: 'admin',
        isActive: true
      }
    });

    console.log('✓ Admin user created successfully');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  Role: admin');
    console.log('\n⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('Error seeding admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();

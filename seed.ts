import { PrismaClient, Role, MembershipStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function staffMemberNumber(role: Role) {
  return `AIAP-STAFF-${role}`;
}

async function nextAvailableMemberNumber(preferred: string) {
  const existing = await prisma.member.findUnique({ where: { memberNumber: preferred } });
  if (!existing) return preferred;
  let suffix = 2;
  while (await prisma.member.findUnique({ where: { memberNumber: `${preferred}-${suffix}` } })) {
    suffix += 1;
  }
  return `${preferred}-${suffix}`;
}

async function main() {
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const admins: [string, Role, string][] = [
    ['admin@aiap.local', Role.SUPER_ADMIN, 'AIAP Super Admin'],
    ['president@aiap.local', Role.PRESIDENT, 'AIAP President'],
    ['secretariat@aiap.local', Role.SECRETARIAT, 'AIAP Secretariat'],
    ['treasurer@aiap.local', Role.TREASURER, 'AIAP Treasurer'],
    ['communication@aiap.local', Role.COMMUNICATION, 'AIAP Communication'],
    ['event.organizer@aiap.local', Role.EVENT_ORGANIZER, 'AIAP Event Organizer'],
  ];

  for (const [email, role, name] of admins) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { role, active: true },
        })
      : await prisma.user.create({
          data: {
            email,
            passwordHash,
            role,
            active: true,
          },
        });

    // Never overwrite an existing user's password when reseeding.
    if (!existingUser) {
      console.log(`Created ${email}`);
    } else {
      console.log(`Reconciled ${email} without changing its password`);
    }

    const member = await prisma.member.findUnique({ where: { userId: user.id } });
    if (!member) {
      const memberNumber = await nextAvailableMemberNumber(staffMemberNumber(role));
      await prisma.member.create({
        data: {
          userId: user.id,
          fullName: name,
          city: 'Visakhapatnam',
          status: 'Official',
          membershipStatus: MembershipStatus.ACTIVE,
          memberNumber,
        },
      });
      console.log(`Created staff member profile ${memberNumber}`);
    }
  }

  console.log('AIAP seed completed safely. Existing passwords and member records were preserved.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

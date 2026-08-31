import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";

const PASSWORD_ROUNDS = 12;

export interface SafeUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

function toSafeUser(user: {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}): SafeUser {
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

export class AuthService {
  /** Create a new local account with a hashed password. */
  async register(input: RegisterInput): Promise<SafeUser> {
    const parsed = registerSchema.parse(input);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase() },
    });
    if (existing) {
      throw new Error(
        "An account with this email already exists. Try signing in instead."
      );
    }

    const passwordHash = await bcrypt.hash(parsed.password, PASSWORD_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        passwordHash,
      },
    });

    return toSafeUser(user);
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async verifyPassword(email: string, password: string): Promise<SafeUser | null> {
    const user = await this.findByEmail(email);
    if (!user?.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? toSafeUser(user) : null;
  }

  /** List workspaces the user is an active member of (id + name + role). */
  async listMemberships(userId: string) {
    return prisma.workspaceMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        workspace: { select: { id: true, name: true, slug: true, logoUrl: true, plan: true } },
      },
      orderBy: { joinedAt: "asc" },
    });
  }
}

export const authService = new AuthService();

export { toSafeUser };
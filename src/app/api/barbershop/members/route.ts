import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

// GET — list all members of the barbershop
export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.membership.findMany({
    where: { barbershopId: session.user.barbershopId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id:        m.id,
      userId:    m.user.id,
      name:      m.user.name,
      email:     m.user.email,
      image:     m.user.image,
      role:      m.role,
      active:    m.active,
      trinksId:  m.trinksId,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

// POST — add a new member (create user if needed)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  // Only OWNER can add members
  const callerMembership = await prisma.membership.findUnique({
    where: { userId_barbershopId: { userId: session.user.id, barbershopId } },
    select: { role: true },
  });
  if (callerMembership?.role !== "OWNER") {
    return NextResponse.json({ error: "Apenas o dono pode adicionar membros" }, { status: 403 });
  }

  const { name, email, role } = await req.json();
  if (!name || !email) {
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 });
  }

  const validRoles = ["BARBER", "STAFF", "OWNER"];
  const memberRole = validRoles.includes(role) ? role : "BARBER";

  // Upsert user
  const user = await prisma.user.upsert({
    where:  { email },
    create: { email, name },
    update: {},
    select: { id: true },
  });

  // Check if already a member
  const existing = await prisma.membership.findUnique({
    where: { userId_barbershopId: { userId: user.id, barbershopId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Esse usuário já é membro da barbearia" }, { status: 409 });
  }

  // Generate invite token for the new member
  const inviteToken = randomBytes(32).toString("hex");

  const membership = await prisma.membership.create({
    data: { userId: user.id, barbershopId, role: memberRole, inviteToken },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json({
    member: {
      id:          membership.id,
      userId:      membership.user.id,
      name:        membership.user.name,
      email:       membership.user.email,
      image:       membership.user.image,
      role:        membership.role,
      active:      membership.active,
      trinksId:    membership.trinksId,
      inviteToken,
      createdAt:   membership.createdAt.toISOString(),
    },
  }, { status: 201 });
}

// PATCH — update member role or active status
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const callerMembership = await prisma.membership.findUnique({
    where: { userId_barbershopId: { userId: session.user.id, barbershopId } },
    select: { role: true },
  });
  if (callerMembership?.role !== "OWNER") {
    return NextResponse.json({ error: "Apenas o dono pode editar membros" }, { status: 403 });
  }

  const { membershipId, role, active } = await req.json();
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId é obrigatório" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) {
    const validRoles = ["BARBER", "STAFF", "OWNER"];
    if (validRoles.includes(role)) data.role = role;
  }
  if (active !== undefined) data.active = Boolean(active);

  const updated = await prisma.membership.update({
    where: { id: membershipId, barbershopId },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ ok: true, member: updated });
}

// DELETE — remove a member
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const callerMembership = await prisma.membership.findUnique({
    where: { userId_barbershopId: { userId: session.user.id, barbershopId } },
    select: { role: true },
  });
  if (callerMembership?.role !== "OWNER") {
    return NextResponse.json({ error: "Apenas o dono pode remover membros" }, { status: 403 });
  }

  const { membershipId } = await req.json();
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId é obrigatório" }, { status: 400 });
  }

  // Prevent owner from removing themselves
  const target = await prisma.membership.findUnique({
    where: { id: membershipId, barbershopId },
    select: { userId: true },
  });
  if (target?.userId === session.user.id) {
    return NextResponse.json({ error: "Você não pode remover a si mesmo" }, { status: 400 });
  }

  await prisma.membership.delete({ where: { id: membershipId, barbershopId } });

  return NextResponse.json({ ok: true });
}

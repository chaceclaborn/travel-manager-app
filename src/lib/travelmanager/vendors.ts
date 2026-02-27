import prisma from '@/lib/prisma';
import type { CreateVendorInput, UpdateVendorInput, VendorWithTrips } from './types';

const vendorInclude = {
  trips: { include: { trip: true } },
};

export async function getVendors(userId: string) {
  return prisma.vendor.findMany({
    where: { userId },
    include: vendorInclude,
    orderBy: { name: 'asc' },
  });
}

export async function getVendorById(id: string, userId: string): Promise<VendorWithTrips | null> {
  return prisma.vendor.findFirst({
    where: { id, userId },
    include: vendorInclude,
  });
}

export async function createVendor(data: CreateVendorInput, userId: string) {
  return prisma.vendor.create({
    data: {
      name: data.name,
      category: data.category,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      website: data.website,
      notes: data.notes,
      user: { connect: { id: userId } },
    },
    include: vendorInclude,
  });
}

export async function updateVendor(id: string, data: UpdateVendorInput, userId: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id, userId } });
  if (!vendor) throw new Error('Vendor not found');

  return prisma.vendor.update({
    where: { id },
    data,
    include: vendorInclude,
  });
}

export async function deleteVendor(id: string, userId: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id, userId } });
  if (!vendor) throw new Error('Vendor not found');

  return prisma.vendor.delete({ where: { id } });
}

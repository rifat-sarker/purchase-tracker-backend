import { Category, PrismaClient, ProductStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Mirrors the frontend's SEED array in
// purchase-tracker-frontend/apps/web/src/app/page.tsx — kept in sync by
// hand so the demo data behind the API matches the frontend's in-memory
// mock data exactly.
interface SeedProduct {
  id: string;
  name: string;
  category: Category;
  brand?: string;
  model?: string;
  price: number;
  currency: string;
  purchaseDate: string;
  purchasedFrom?: string;
  warrantyExpiry?: string | null;
  serialNumber?: string | null;
  status: ProductStatus;
  tags: string[];
  notified: boolean;
  receipts: number;
  notes?: string;
  specs: Record<string, string>;
  referenceImage?: string;
}

const SEED: SeedProduct[] = [
  { id: 'ckq1', name: 'Samsung Galaxy S23', category: 'PHONE', brand: 'Samsung', model: 'SM-S911B', price: 89500, currency: 'BDT', purchaseDate: '2025-09-05', warrantyExpiry: '2026-09-05', purchasedFrom: 'Star Tech, Dhaka', serialNumber: '354812097654321', status: 'ACTIVE', tags: ['daily-driver', '5g'], notified: true, receipts: 2, notes: 'Traded in the S21 at the counter; official warranty card in the folder.', specs: { Storage: '256 GB', RAM: '8 GB', Display: '6.1" 120Hz', Color: 'Phantom Black' }, referenceImage: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq2', name: 'MacBook Air M2', category: 'LAPTOP', brand: 'Apple', model: 'A2681', price: 142000, currency: 'BDT', purchaseDate: '2025-11-02', warrantyExpiry: '2026-11-02', purchasedFrom: 'Apple Gadget Store, Bashundhara', serialNumber: 'C02H4KJ9Q6L4', status: 'ACTIVE', tags: ['work', 'primary'], notified: false, receipts: 3, notes: 'Midnight, 16GB/512GB config ordered in.', specs: { RAM: '16 GB', Storage: '512 GB SSD', Chip: 'Apple M2', Color: 'Midnight' }, referenceImage: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq3', name: 'Mac Mini M2', category: 'DESKTOP', brand: 'Apple', model: 'A2686', price: 78000, currency: 'BDT', purchaseDate: '2026-03-20', warrantyExpiry: '2027-03-20', purchasedFrom: 'Apple Gadget Store, Bashundhara', serialNumber: 'C07J2LMQ1P8T', status: 'ACTIVE', tags: ['home-server'], notified: false, receipts: 1, notes: 'Runs the local Postgres + Redis containers.', specs: { RAM: '8 GB', Storage: '256 GB SSD', Chip: 'Apple M2' }, referenceImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq4', name: 'LG 27UP850 Monitor', category: 'MONITOR', brand: 'LG', model: '27UP850-W', price: 62000, currency: 'BDT', purchaseDate: '2026-04-05', warrantyExpiry: '2029-04-05', purchasedFrom: 'Ryans Computers, Farmgate', serialNumber: '204NTQK8L212', status: 'ACTIVE', tags: ['4k', 'usb-c'], notified: false, receipts: 2, notes: '96W USB-C passthrough — one cable to the Air.', specs: { Size: '27"', Resolution: '3840 × 2160', Panel: 'IPS', Power: '96W USB-C' }, referenceImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq5', name: 'Anker 7-in-1 USB-C Hub', category: 'HUB', brand: 'Anker', model: 'A8346', price: 4200, currency: 'BDT', purchaseDate: '2026-05-11', warrantyExpiry: '2028-05-11', purchasedFrom: 'Gadget & Gear', serialNumber: 'AK7H29LX', status: 'ACTIVE', tags: ['travel'], notified: false, receipts: 1, notes: 'Bought with the cable below on the same memo.', specs: { Ports: '7', HDMI: '4K@30Hz', 'Card reader': 'SD + microSD' }, referenceImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq6', name: 'Anker USB-C to USB-C Cable', category: 'CABLE', brand: 'Anker', model: 'PowerLine III', price: 1150, currency: 'BDT', purchaseDate: '2026-05-11', warrantyExpiry: null, purchasedFrom: 'Gadget & Gear', serialNumber: null, status: 'BROKEN', tags: ['100w'], notified: false, receipts: 1, notes: 'Frayed at the connector after three months.', specs: { Length: '1.8 m', Rating: '100 W', Braid: 'Nylon' }, referenceImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq7', name: 'SanDisk Extreme 64GB Pendrive', category: 'PENDRIVE', brand: 'SanDisk', model: 'SDCZ880-064G', price: 1450, currency: 'BDT', purchaseDate: '2026-02-08', warrantyExpiry: '2031-02-08', purchasedFrom: 'Computer Source', serialNumber: null, status: 'LOST', tags: ['bootable'], notified: false, receipts: 1, notes: 'Held the Ubuntu installer. Last seen in a laptop bag.', specs: { Capacity: '64 GB', Read: '420 MB/s', Interface: 'USB 3.2' }, referenceImage: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq8', name: 'Logitech MX Keys', category: 'KEYBOARD', brand: 'Logitech', model: '920-009415', price: 12800, currency: 'BDT', purchaseDate: '2026-06-01', warrantyExpiry: '2027-06-01', purchasedFrom: 'Star Tech, Dhaka', serialNumber: '2213LZ0A4BC8', status: 'ACTIVE', tags: ['desk'], notified: false, receipts: 1, notes: 'Bought together with the MX Master 3S.', specs: { Layout: 'Full size', Backlight: 'Yes', Connectivity: 'Bolt + Bluetooth' }, referenceImage: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq9', name: 'Logitech MX Master 3S', category: 'MOUSE', brand: 'Logitech', model: '910-006559', price: 11500, currency: 'BDT', purchaseDate: '2025-09-10', warrantyExpiry: '2026-09-10', purchasedFrom: 'Star Tech, Dhaka', serialNumber: '2213MX3S0091', status: 'ACTIVE', tags: ['desk', 'quiet-click'], notified: true, receipts: 1, notes: 'Graphite. Silent switches.', specs: { DPI: '8000', Buttons: '7', Connectivity: 'Bolt + Bluetooth' }, referenceImage: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq10', name: 'Sony WH-1000XM4 Headphones', category: 'HEADPHONE', brand: 'Sony', model: 'WH-1000XM4', price: 28900, currency: 'BDT', purchaseDate: '2025-09-22', warrantyExpiry: '2026-09-22', purchasedFrom: 'Sony Center, Gulshan', serialNumber: '4901780291234', status: 'ACTIVE', tags: ['anc', 'commute'], notified: false, receipts: 2, notes: 'Earpads replaced once out of pocket.', specs: { ANC: 'Yes', Battery: '30 h', Codec: 'LDAC' }, referenceImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80' },
  { id: 'ckq11', name: 'Anker 20W USB-C Charger', category: 'CHARGER', brand: 'Anker', model: 'A2633', price: 1890, currency: 'BDT', purchaseDate: '2026-07-19', warrantyExpiry: '2027-07-19', purchasedFrom: 'Gadget & Gear', serialNumber: null, status: 'ACTIVE', tags: ['travel'], notified: false, receipts: 1, notes: 'Spare for the go-bag.', specs: { Output: '20 W', Ports: '1 × USB-C' }, referenceImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80' },
];

async function seedOwner() {
  const email = process.env.OWNER_EMAIL;

  if (!email) {
    console.warn('⚠️  OWNER_EMAIL not set — skipping owner user seed.');
    return;
  }

  let passwordHash = process.env.OWNER_PASSWORD_HASH;

  if (!passwordHash) {
    const defaultPassword = 'changeme123';
    console.warn(
      `⚠️  OWNER_PASSWORD_HASH not set — hashing default seed password "${defaultPassword}". CHANGE THIS before deploying to production!`,
    );
    passwordHash = await bcrypt.hash(defaultPassword, 12);
  }

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`✔ Owner user seeded: ${email}`);
}

async function seedProducts() {
  let created = 0;

  for (const p of SEED) {
    const existing = await prisma.product.findFirst({ where: { name: p.name, purchaseDate: new Date(p.purchaseDate) } });
    if (existing) continue;

    await prisma.product.create({
      data: {
        name: p.name,
        category: p.category,
        brand: p.brand ?? null,
        model: p.model ?? null,
        specs: p.specs,
        referenceImage: p.referenceImage ?? null,
        price: p.price,
        currency: p.currency,
        purchaseDate: new Date(p.purchaseDate),
        purchasedFrom: p.purchasedFrom ?? null,
        warrantyExpiry: p.warrantyExpiry ? new Date(p.warrantyExpiry) : null,
        serialNumber: p.serialNumber ?? null,
        // receipts is just a count in the frontend mock — seed that many
        // placeholder receipt URLs so receiptImages.length matches.
        receiptImages: Array.from({ length: p.receipts }, (_, i) => `/uploads/receipts/seed-${p.id}-${i + 1}.jpg`),
        notes: p.notes ?? null,
        status: p.status,
        tags: p.tags,
        warrantyNotified: p.notified,
      },
    });
    created += 1;
  }

  console.log(`✔ Seeded ${created} product(s) (${SEED.length - created} already existed).`);
}

async function main() {
  await seedOwner();
  await seedProducts();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

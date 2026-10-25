import { z } from 'zod';
export const denominationSchema = z.enum(['INR', 'POINTS']);
export type Denomination = z.infer<typeof denominationSchema>;
export const healthSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  service: z.literal('sports-auction-api'),
  database: z.enum(['connected', 'unavailable']).optional(),
});
export type Health = z.infer<typeof healthSchema>;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12, 'Use at least 12 characters').max(128),
});
const moneySchema = z.number().int().nonnegative().safe();
const auctionFields = {
  name: z.string().trim().min(2).max(100),
  sport: z.string().trim().min(2).max(60),
  denomination: denominationSchema,
  defaultBudget: moneySchema,
  defaultSlots: z.number().int().min(1).max(1000),
  minimumPrice: moneySchema.nullable().default(null),
  logoUrl: z
    .string()
    .url()
    .max(2048)
    .refine((url) => url.startsWith('https://'), 'Use an HTTPS image URL')
    .nullable()
    .default(null),
};
export const createAuctionSchema = z.object(auctionFields).strict();
export const updateAuctionSchema = z
  .object(auctionFields)
  .partial()
  .extend({ version: z.number().int().nonnegative() })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 1,
    'Provide a setting to update',
  );
export type AuctionInput = z.infer<typeof createAuctionSchema>;
export interface Organizer {
  id: string;
  name: string;
  email: string;
}
export interface Auction extends AuctionInput {
  id: string;
  status: 'DRAFT' | 'LIVE' | 'PAUSED' | 'COMPLETED';
  version: number;
  createdAt: string;
}

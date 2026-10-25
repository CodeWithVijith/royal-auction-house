import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Sports Auction | Organizer workspace',
  description: 'A foundation for fair, organized sports auctions.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

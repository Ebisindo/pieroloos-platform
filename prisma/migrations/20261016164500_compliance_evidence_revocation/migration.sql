-- Evidence revocation is terminal for a single evidence record. Corrected facts must be attached as a replacement.
ALTER TYPE "EvidenceReviewStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

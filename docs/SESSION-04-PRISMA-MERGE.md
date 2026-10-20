# Prisma Session 04 schema additions

Add/verify these fields on the existing Client, BusinessProfile and Engagement models.

```prisma
model Client {
  id              String          @id @default(cuid())
  legalName       String
  email           String?
  phone           String?
  residenceCountry String?
  businessProfile BusinessProfile?
  engagements     Engagement[]
  activities      Activity[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model BusinessProfile {
  id                   String   @id @default(cuid())
  clientId             String   @unique
  businessName         String?
  businessModel        String?
  targetMarket         String?
  revenueModel         String?
  ownership            String?
  expansionObjectives  String?
  fundingStage         String?
  riskConstraints     String?
  strategicNotes      String?
  operationalContext  String?
  client              Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

model Engagement {
  id         String   @id @default(cuid())
  clientId   String
  service    String
  status     String   @default("INTAKE")
  nextAction String?
  notes      String?
  client     Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

If these models already exist in your Session 02 schema, merge the missing fields instead of creating duplicate models.

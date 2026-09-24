# Prisma additions for Session 05

Merge into the existing Session 04 schema. Do not replace the whole schema.

```prisma
enum ActivityType {
  CREATED
  UPDATED
  REVIEWED
  APPROVED
  COMPLETED
  COMMENTED
  STATUS_CHANGED
  DOCUMENT_ATTACHED
}

model Engagement {
  id         String     @id @default(cuid())
  clientId   String
  service    String
  status     String     @default("INTAKE")
  ownerId    String?
  nextAction String?
  notes      String?
  client     Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  activities Activity[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model Activity {
  id           String       @id @default(cuid())
  engagementId String
  type         ActivityType
  title        String
  description  String?
  actorId      String?
  engagement   Engagement   @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  createdAt    DateTime     @default(now())

  @@index([engagementId, createdAt])
}
```

Then:
`npx prisma format`
`npx prisma generate`
`npx prisma migrate dev --name engagement-activity-engine`

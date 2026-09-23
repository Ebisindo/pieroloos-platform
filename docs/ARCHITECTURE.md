# PieroloOS Foundation Architecture

UI → Application Services → Domain/Business Rules → Repository/Data Access → PostgreSQL.

The UI should not contain persistence or core business rules. Evidence and source quality are first-class concepts. Organization and workspace boundaries are modeled from the start. Human decision authority remains separate from automated preparation.

## First vertical slice
Client Intake → Business Profile → Engagement → Jurisdiction Lens → Formation → Compliance → Report → Engagement Record.

## Brand rule
`public/brand/pierolocorp-logo.webp` is the authoritative supplied logo asset. Do not redraw or morph the mark.
  

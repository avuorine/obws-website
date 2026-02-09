import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  serial,
} from 'drizzle-orm/pg-core'

// --- Enums ---

export const memberStatusEnum = pgEnum('member_status', ['active', 'inactive', 'honorary'])

export const allocationMethodEnum = pgEnum('allocation_method', ['first_come', 'lottery'])

export const eventStatusEnum = pgEnum('event_status', ['draft', 'published', 'cancelled', 'completed'])

export const registrationStatusEnum = pgEnum('registration_status', [
  'registered',
  'waitlisted',
  'cancelled',
  'pending',
])

export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid', 'overdue'])

export const invoiceTypeEnum = pgEnum('invoice_type', ['membership_fee', 'event_fee'])

export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'cancelled'])

// --- Localized JSON type helper ---
export type LocalizedText = { sv?: string; fi?: string; en?: string }

// --- better-auth core tables ---

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Custom member fields
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  municipality: text('municipality'),
  dateOfBirth: text('date_of_birth'),
  status: memberStatusEnum('status').default('active'),
  memberNumber: integer('member_number').unique(),
  memberSince: timestamp('member_since'),
  resignedAt: timestamp('resigned_at'),
  marketingEmails: boolean('marketing_emails').notNull().default(true),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const passkey = pgTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credential_id').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull().default(false),
  transports: text('transports'),
  aaguid: text('aaguid'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// --- Application tables ---

export const eventCategories = pgTable('event_categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text('slug').notNull().unique(),
  nameLocales: jsonb('name_locales').$type<LocalizedText>().notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  categoryId: text('category_id').references(() => eventCategories.id),
  titleLocales: jsonb('title_locales').$type<LocalizedText>().notNull(),
  summaryLocales: jsonb('summary_locales').$type<LocalizedText>(),
  descriptionLocales: jsonb('description_locales').$type<LocalizedText>(),
  locationLocales: jsonb('location_locales').$type<LocalizedText>(),
  date: timestamp('date').notNull(),
  endDate: timestamp('end_date'),
  capacity: integer('capacity'),
  price: numeric('price', { precision: 10, scale: 2 }),
  allocationMethod: allocationMethodEnum('allocation_method').default('first_come'),
  registrationOpensAt: timestamp('registration_opens_at'),
  registrationDeadline: timestamp('registration_deadline'),
  lotteryDate: timestamp('lottery_date'),
  lotteryCompleted: boolean('lottery_completed').default(false),
  registrationCount: integer('registration_count').default(0),
  waitlistCount: integer('waitlist_count').default(0),
  cancellationAllowed: boolean('cancellation_allowed').notNull().default(true),
  cancellationDeadline: timestamp('cancellation_deadline'),
  status: eventStatusEnum('status').default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const tastingWhiskies = pgTable('tasting_whiskies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  distillery: text('distillery'),
  region: text('region'),
  age: text('age'),
  abv: text('abv'),
  notesLocales: jsonb('notes_locales').$type<LocalizedText>(),
  sortOrder: integer('sort_order').default(0),
})

export const eventRegistrations = pgTable('event_registrations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  status: registrationStatusEnum('status').notNull().default('registered'),
  registeredAt: timestamp('registered_at').notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// --- Fee & Invoice tables ---

export const feePeriods = pgTable('fee_periods', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const memberFees = pgTable('member_fees', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  feePeriodId: text('fee_period_id')
    .notNull()
    .references(() => feePeriods.id, { onDelete: 'cascade' }),
  status: paymentStatusEnum('status').notNull().default('unpaid'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: integer('invoice_number').notNull().unique(),
  type: invoiceTypeEnum('type').notNull(),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  feePeriodId: text('fee_period_id').references(() => feePeriods.id),
  eventRegistrationId: text('event_registration_id').references(() => eventRegistrations.id),
  recipientName: text('recipient_name').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  referenceNumber: text('reference_number').notNull(),
  paidAt: timestamp('paid_at'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const invoiceCounter = pgTable('invoice_counter', {
  id: serial('id').primaryKey(),
  nextNumber: integer('next_number').notNull().default(1),
})

export const associationSettings = pgTable('association_settings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default(''),
  address: text('address').default(''),
  businessId: text('business_id').default(''),
  iban: text('iban').default(''),
  bic: text('bic').default(''),
  email: text('email').default(''),
  phone: text('phone').default(''),
  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
})

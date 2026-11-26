import { z } from 'zod';
import { HttpError } from './errors.js';

// ==========================================
// COMMON VALIDATION
// ==========================================

export function parse(schema, data) {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new HttpError(
      400,
      'Please fix the highlighted fields',
      result.error.flatten().fieldErrors
    );
  }

  return result.data;
}

const uuid = z.string().uuid();

// Validate both date format and actual calendar date.
const isoDate = z.iso.date({
  error: 'Enter a valid calendar date in YYYY-MM-DD format',
});

// ==========================================
// REGISTRATION VALIDATION
// ==========================================

export const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80),

  email: z.string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(255),

  password: z.string()
    .min(8, 'Use at least 8 characters')
    .max(72)
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 72,
      'Password must not exceed 72 bytes'
    ),

  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),

}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// ==========================================
// EMAIL OTP VALIDATION
// ==========================================

export const verifyOTPSchema = z.object({
  registrationId: z.string().uuid(
    'Invalid registration request'
  ),

  otp: z.string().regex(
    /^\d{6}$/,
    'Enter a valid 6-digit OTP'
  ),
});

export const resendOTPSchema = z.object({
  registrationId: z.string().uuid(
    'Invalid registration request'
  ),
});

// ==========================================
// LOGIN VALIDATION
// ==========================================

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address'),

  password: z.string()
    .min(1, 'Enter your password'),
});

// ==========================================
// PROJECT VALIDATION
// ==========================================

export const projectSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120),

  description: z.string()
    .trim()
    .max(1000)
    .default(''),
});

// ==========================================
// MEMBER VALIDATION
// ==========================================

export const memberSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address'),
});

// ==========================================
// TASK VALIDATION
// ==========================================

const taskFields = {
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(160),

  description: z.string().max(5000),

  status: z.enum([
    'todo',
    'in_progress',
    'done',
  ]),

  priority: z.enum([
    'low',
    'medium',
    'high',
  ]),

  assigneeId: uuid.nullable(),

  dueDate: isoDate.nullable(),
};

// Create task

export const createTaskSchema = z.object({
  title: taskFields.title,

  description: taskFields.description.default(''),

  status: taskFields.status.default('todo'),

  priority: taskFields.priority.default('medium'),

  assigneeId: taskFields.assigneeId.optional(),

  dueDate: taskFields.dueDate.optional(),
});

// Update task with concurrency protection

export const updateTaskSchema = z.object({
  ...taskFields,

  expectedVersion: z.number()
    .int()
    .min(1, 'Invalid task version')
    .max(2147483647),

}).partial()
  .refine(
    (data) => Object.keys(taskFields).some(
      (key) => Object.hasOwn(data, key)
    ),
    'Nothing to update'
  );

// Move task

export const moveTaskSchema = z.object({
  status: taskFields.status,

  index: z.number()
    .int()
    .min(0),
});

// ==========================================
// TASK SEARCH AND FILTER VALIDATION
// ==========================================

export const taskQuerySchema = z.object({
  search: z.string()
    .trim()
    .max(160, 'Search text is too long')
    .optional(),

  status: taskFields.status.optional(),

  priority: taskFields.priority.optional(),

  assignee: z.union([
    uuid,
    z.literal('none'),
  ]).optional(),
});

// ==========================================
// COMMENT VALIDATION
// ==========================================

export const commentSchema = z.object({
  body: z.string()
    .trim()
    .min(1, 'Write a comment first')
    .max(2000),
});

// ==========================================
// FORGOT PASSWORD VALIDATION
// ==========================================

export const forgotPasswordSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(255),
});

// Password reset OTP verification

export const verifyResetOTPSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(255),

  otp: z.string()
    .regex(/^\d{6}$/, 'Enter a valid 6-digit OTP'),
});

// New password validation

export const resetPasswordSchema = z.object({
  resetToken: z.string()
    .regex(
      /^[A-Za-z0-9_-]{43}$/,
      'Invalid reset token'
    ),

  password: z.string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Password is too long')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 72,
      'Password must not exceed 72 bytes'
    ),

  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),

}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// ==========================================
// PULSE AI REQUEST VALIDATION
// ==========================================

// Smart Planner

export const aiPlannerSchema = z.object({
  mode: z.enum([
    'project',
    'natural',
    'meeting',
  ]).default('project'),

  prompt: z.string()
    .trim()
    .min(3, 'Please enter a meaningful instruction')
    .max(10000, 'Instruction is too long'),

}).strict();

// Project Intelligence

export const aiIntelligenceSchema = z.object({})
  .strict();

// Smart Assignment

export const aiAssignmentSchema = z.object({
  taskId: uuid,
}).strict();

// Ask Pulse AI

export const aiQuestionSchema = z.object({
  question: z.string()
    .trim()
    .min(3, 'Please enter a meaningful question')
    .max(1000, 'Question is too long'),

}).strict();

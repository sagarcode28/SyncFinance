import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { User as IUser, UserRole } from '../types/index.js';

export interface UserDocument extends Omit<IUser, 'id'>, Document {
  password: string;
  refreshToken?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password by default
    },
    role: {
      type: String,
      enum: ['admin', 'finance_manager', 'viewer'],
      default: 'viewer',
    },
    avatar: {
      type: String,
      default: function(this: UserDocument) {
        return this.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      },
    },
    color: {
      type: String,
      default: function() {
        const colors = ['#007cf0', '#7928ca', '#ff0080', '#f5a623', '#50e3c2', '#ff4d4d'];
        return colors[Math.floor(Math.random() * colors.length)];
      },
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<UserDocument>('User', userSchema);

export default User;

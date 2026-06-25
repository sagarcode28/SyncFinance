import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useApp } from '../../context/AppContext';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface FormValues {
  email: string;
  password: string;
}

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});

export function LoginForm() {
  const { login, navigate } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');

  const formik = useFormik<FormValues>({
    initialValues: { email: '', password: '' },
    validationSchema: loginSchema,
    onSubmit: async (values) => {
      setApiError('');
      const success = await login(values.email, values.password);
      if (!success) {
        setApiError('Invalid email or password. Please try again.');
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      {apiError && (
        <div className="bg-error-soft text-error-deep text-sm px-3 py-2.5 rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.email}
          className={`w-full h-10 px-3 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
            formik.touched.email && formik.errors.email ? 'border-error' : 'border-hairline'
          }`}
          placeholder="you@company.com"
        />
        {formik.touched.email && formik.errors.email && (
          <p className="text-xs text-error mt-1">{formik.errors.email}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <button
            type="button"
            onClick={() => navigate('register')}
            className="text-xs text-link hover:text-link-deep transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.password}
            className={`w-full h-10 px-3 pr-10 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
              formik.touched.password && formik.errors.password ? 'border-error' : 'border-hairline'
            }`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {formik.touched.password && formik.errors.password && (
          <p className="text-xs text-error mt-1">{formik.errors.password}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={formik.isSubmitting || !formik.isValid}
        className="w-full h-10 bg-ink text-on-primary text-sm font-medium rounded-md hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {formik.isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </button>
    </form>
  );
}

interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'admin' | 'finance_manager' | 'viewer';
  agreeTerms: boolean;
}

const registerSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .required('Full name is required'),
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
  role: Yup.string()
    .oneOf(['admin', 'finance_manager', 'viewer'])
    .required('Please select a role'),
  agreeTerms: Yup.boolean()
    .oneOf([true], 'You must accept the terms to continue')
    .required('You must accept the terms'),
});

export function RegisterForm() {
  const { register } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');

  const formik = useFormik<RegisterFormValues>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'admin',
      agreeTerms: false,
    },
    validationSchema: registerSchema,
    onSubmit: async (values) => {
      setApiError('');
      const success = await register(values.name, values.email, values.password, values.role);
      if (!success) {
        setApiError('Failed to create account. Email may already be registered.');
      }
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      {apiError && (
        <div className="bg-error-soft text-error-deep text-sm px-3 py-2.5 rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.name}
          className={`w-full h-10 px-3 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
            formik.touched.name && formik.errors.name ? 'border-error' : 'border-hairline'
          }`}
          placeholder="Alex Chen"
        />
        {formik.touched.name && formik.errors.name && (
          <p className="text-xs text-error mt-1">{formik.errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="reg-email" className="block text-sm font-medium text-ink mb-1.5">
          Work email
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.email}
          className={`w-full h-10 px-3 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
            formik.touched.email && formik.errors.email ? 'border-error' : 'border-hairline'
          }`}
          placeholder="you@company.com"
        />
        {formik.touched.email && formik.errors.email && (
          <p className="text-xs text-error mt-1">{formik.errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="reg-password" className="block text-sm font-medium text-ink mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            id="reg-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.password}
            className={`w-full h-10 px-3 pr-10 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
              formik.touched.password && formik.errors.password ? 'border-error' : 'border-hairline'
            }`}
            placeholder="Create a strong password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {formik.touched.password && formik.errors.password && (
          <p className="text-xs text-error mt-1">{formik.errors.password}</p>
        )}
        {formik.values.password && (
          <ul className="text-xs text-mute mt-2 space-y-1">
            <li className={formik.values.password.length >= 8 ? 'text-cyan-deep' : ''}>✓ At least 8 characters</li>
            <li className={/[A-Z]/.test(formik.values.password) ? 'text-cyan-deep' : ''}>✓ One uppercase letter</li>
            <li className={/[a-z]/.test(formik.values.password) ? 'text-cyan-deep' : ''}>✓ One lowercase letter</li>
            <li className={/[0-9]/.test(formik.values.password) ? 'text-cyan-deep' : ''}>✓ One number</li>
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1.5">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values.confirmPassword}
          className={`w-full h-10 px-3 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
            formik.touched.confirmPassword && formik.errors.confirmPassword ? 'border-error' : 'border-hairline'
          }`}
          placeholder="Re-enter your password"
        />
        {formik.touched.confirmPassword && formik.errors.confirmPassword && (
          <p className="text-xs text-error mt-1">{formik.errors.confirmPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-2">
          Account type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'admin', label: 'Admin', desc: 'Create & manage workspaces' },
            { value: 'finance_manager', label: 'Editor', desc: 'Edit & collaborate' },
            { value: 'viewer', label: 'Viewer', desc: 'View only' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => formik.setFieldValue('role', opt.value)}
              className={`p-3 rounded-md border text-left transition-all ${
                formik.values.role === opt.value
                  ? 'border-link bg-link-bg-soft text-ink'
                  : 'border-hairline text-body hover:border-hairline-strong hover:text-ink'
              }`}
            >
              <p className="text-xs font-medium leading-tight">{opt.label}</p>
              <p className="text-[10px] text-mute mt-0.5 leading-tight">{opt.desc}</p>
            </button>
          ))}
        </div>
        {formik.touched.role && formik.errors.role && (
          <p className="text-xs text-error mt-1">{formik.errors.role}</p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <input
          id="agreeTerms"
          name="agreeTerms"
          type="checkbox"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          checked={formik.values.agreeTerms}
          className="mt-1 w-4 h-4 rounded border-hairline text-ink focus:ring-ink"
        />
        <label htmlFor="agreeTerms" className="text-sm text-body">
          I agree to the{' '}
          <a href="#" className="text-link hover:text-link-deep">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-link hover:text-link-deep">Privacy Policy</a>
        </label>
      </div>
      {formik.touched.agreeTerms && formik.errors.agreeTerms && (
        <p className="text-xs text-error">{formik.errors.agreeTerms}</p>
      )}

      <button
        type="submit"
        disabled={formik.isSubmitting || !formik.isValid || !formik.dirty}
        className="w-full h-10 bg-ink text-on-primary text-sm font-medium rounded-md hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {formik.isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </button>
    </form>
  );
}

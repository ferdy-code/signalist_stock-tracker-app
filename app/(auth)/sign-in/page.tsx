'use client'

import FooterLink from '@/components/forms/FooterLink';
import InputField from '@/components/forms/InputField';
import { Button } from '@/components/ui/button';
import { signInWithEmail } from '@/lib/actions/auth.actions';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form'
import { toast } from 'sonner';

const SignIn = () => {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur'
  });

  const onSubmit = async (data: SignInFormData) => {
    try {
      const result = await signInWithEmail(data);
      if (result.success) router.push('/')
    } catch (e) {
      console.error(e);
      toast.error('Sign up failed', {
        description: e instanceof Error ? e.message : 'Failed to create an account'
      })
    }
  }

  return (
    <>
      <h1 className="form-title">Sign In</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <InputField
          name="email"
          label="Email"
          placeholder="contact@example.com"
          register={register}
          error={errors.email}
          validation={{ required: 'Email is required', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' }}
        />

        <InputField
          type='password'
          name="password"
          label="Password"
          placeholder="Enter your password"
          register={register}
          error={errors.password}
          validation={{ required: 'Password is required', minLength: 8 }}
        />

        <Button type='submit' disabled={isSubmitting} className='yellow-btn w-full mt-5'>
          {isSubmitting ? 'Signing In...' : 'Sign In'}
        </Button>

        <FooterLink
          text="Don't have an account?"
          linkText="Sign Up"
          href="/sign-up"
        />
      </form>
    </>
  )
}

export default SignIn

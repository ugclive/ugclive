const express = require('express');
const router = express.Router();
const { supabase, verifyAuth, requireAdmin } = require('../libs/supabase/auth');

/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create a profile for the user with default values
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            username: username || null,
            email: email,
            role: 'user', // Default role
            plan: 'free', // Default plan
            credits: 5, // Default starting credits
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // If profile creation fails, we should still return success since the auth account was created
      }
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      user: authData.user,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    res.json({
      message: 'Login successful',
      session: data.session,
      user: data.user,
      profile: profile || null,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Send password reset email
 * @access Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route GET /api/auth/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', verifyAuth, async (req, res) => {
  try {
    // User data already attached from middleware
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile: data });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, avatar_url } = req.body;

    // Only update provided fields
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ profile: data });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route GET /api/auth/admin/users
 * @desc Get all users (admin only)
 * @access Admin
 */
router.get('/admin/users', verifyAuth, requireAdmin, async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get users from profiles table
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      users: data,
      totalCount: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route PUT /api/auth/admin/users/:userId
 * @desc Update user role and plan (admin only)
 * @access Admin
 */
router.put('/admin/users/:userId', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, plan, credits } = req.body;

    // Validate user ID
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only update provided fields
    const updates = {};
    if (role !== undefined) updates.role = role;
    if (plan !== undefined) updates.plan = plan;
    if (credits !== undefined) updates.credits = credits;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      message: 'User updated successfully',
      user: data 
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route POST /api/auth/admin/create-user
 * @desc Create a new user (admin only)
 * @access Admin
 */
router.post('/admin/create-user', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, username, role, plan, credits } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm the email
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create a profile for the user
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            username: username || null,
            email: email,
            role: role || 'user',
            plan: plan || 'free',
            credits: credits || 5,
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return res.status(400).json({ error: profileError.message });
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      user: authData.user,
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 
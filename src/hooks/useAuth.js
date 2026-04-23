/**
 * useAuth.js - BioBalance
 * 
 * CLEAN AUTH HOOK
 * ==============
 * This hook ONLY provides login functions.
 * It does NOT have its own auth listener (that's in App.js).
 * 
 * After successful login, Supabase fires onAuthStateChange → App.js handles it.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
} from '../api/supabaseClient';

// Required for OAuth
WebBrowser.maybeCompleteAuthSession();

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ================================================
  // OAuth LOGIN (Google / Apple / Facebook)
  // ================================================
  const loginWithOAuth = useCallback(async (provider) => {
    setError(null);
    setLoading(true);
    
    try {
      console.log(`[useAuth] Starting ${provider} OAuth...`);
      
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'biobalance://auth/callback',
          skipBrowserRedirect: true,
        },
      });
      
      if (authError) throw authError;
      
      if (data?.url) {
        console.log(`[useAuth] Opening browser for ${provider}...`);
        
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          'biobalance://auth/callback'
        );
        
        if (result.type === 'success' && result.url) {
          console.log('[useAuth] OAuth callback received');
          
          // Extract tokens from URL (implicit flow)
          const url = result.url;
          let accessToken = null;
          let refreshToken = null;
          
          if (url.includes('#')) {
            const fragment = url.split('#')[1];
            const params = new URLSearchParams(fragment);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          } else if (url.includes('?')) {
            const params = new URL(url).searchParams;
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
          }
          
          if (accessToken) {
            console.log('[useAuth] Setting session with tokens...');
            
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (sessionError) {
              console.log('[useAuth] Set session error:', sessionError.message);
              throw sessionError;
            }
            
            if (sessionData?.user) {
              console.log('[useAuth] ✅ OAuth login successful:', sessionData.user.email);
              // App.js will receive SIGNED_IN event and update state
              return { success: true };
            }
          } else {
            console.log('[useAuth] No access token in URL');
            throw new Error('No access token in response');
          }
        } else if (result.type === 'cancel') {
          console.log('[useAuth] User cancelled OAuth');
          return { success: false, cancelled: true };
        }
      }
      
      return { success: false };
      
    } catch (err) {
      console.error(`[useAuth] ${provider} login error:`, err);
      setError(err.message);
      Alert.alert('שגיאה', 'לא הצלחנו להתחבר. נסה שוב.');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================================
  // PROVIDER-SPECIFIC LOGIN FUNCTIONS
  // ================================================
  const loginWithGoogle = useCallback(() => loginWithOAuth('google'), [loginWithOAuth]);
  const loginWithApple = useCallback(() => loginWithOAuth('apple'), [loginWithOAuth]);
  const loginWithFacebook = useCallback(() => loginWithOAuth('facebook'), [loginWithOAuth]);

  // ================================================
  // EMAIL LOGIN
  // ================================================
  const loginWithEmail = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[useAuth] Email login for:', email);
      
      const { data, error: authError } = await signInWithEmail(email, password);
      
      if (authError) throw authError;
      
      if (data?.user) {
        console.log('[useAuth] ✅ Email login successful:', data.user.email);
        // App.js will receive SIGNED_IN event and update state
        return { success: true };
      }
      
      return { success: false };
      
    } catch (err) {
      console.error('[useAuth] Email login error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================================
  // EMAIL REGISTRATION
  // ================================================
  const registerWithEmail = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[useAuth] Registering email:', email);
      
      const { data, error: authError } = await signUpWithEmail(email, password);
      
      if (authError) throw authError;
      
      console.log('[useAuth] ✅ Registration successful');
      return { success: true, data };
      
    } catch (err) {
      console.error('[useAuth] Registration error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================================
  // RETURN VALUES
  // ================================================
  return {
    loading,
    error,
    // Auth ready flags (always true since we don't have complex setup)
    googleAuthReady: true,
    facebookAuthReady: true,
    appleAuthReady: true,
    // Login functions
    loginWithGoogle,
    loginWithFacebook,
    loginWithApple,
    loginWithEmail,
    registerWithEmail,
  };
};

export default useAuth;

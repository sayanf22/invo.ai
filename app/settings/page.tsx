"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Settings, Bell, Lock, User, CreditCard, ArrowLeft } from "lucide-react"
import { PaymentSettings } from "@/components/payment-settings"
import { motion } from "framer-motion"
import Link from "next/link"

const tabVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [loading, setLoading] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
    }
  }, [user])

  const handleUpdateEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const newEmail = formData.get("email") as string

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
      toast.success("Email update link sent! Check your inbox")
    } catch (error: any) {
      toast.error(error.message || "Failed to update email")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const newPassword = formData.get("newPassword") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match")
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success("Password updated successfully")
      e.currentTarget.reset()
    } catch (error: any) {
      toast.error(error.message || "Failed to update password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <ClorefyLogo size={24} />
              <span className="font-semibold text-sm">Settings</span>
            </div>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="container mx-auto p-4 sm:p-6 max-w-4xl pt-6 sm:pt-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">
            <User className="w-4 h-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="w-4 h-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6 outline-none">
            <motion.div variants={tabVariants} initial="hidden" animate="visible" className="space-y-6">
              <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle>Email Address</CardTitle>
              <CardDescription>
                Update your email address. You'll need to verify the new email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user?.email}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Email"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-muted-foreground">User ID</Label>
                <p className="text-sm font-mono">{user?.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Account Created</Label>
                <p className="text-sm">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
            </motion.div>
        </TabsContent>

        <TabsContent value="payments" className="mt-6 outline-none">
            <motion.div variants={tabVariants} initial="hidden" animate="visible" className="space-y-6">
          <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle>Payment Collection</CardTitle>
              <CardDescription>
                Connect your payment gateway to collect payments from invoices. Money goes directly to your bank account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentSettings />
            </CardContent>
          </Card>

          {/* Implementation Guides */}
          <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Setup Guides</span>
                <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Step-by-step</span>
              </CardTitle>
              <CardDescription>
                Full implementation guide for each payment gateway — API keys, webhook configuration, and troubleshooting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-3">
                {/* Razorpay */}
                <Link
                  href="/integrations/payments/razorpay"
                  target="_blank"
                  className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#072654] flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">Razorpay</p>
                    <p className="text-xs text-muted-foreground mt-0.5">UPI, cards, netbanking</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </Link>
                {/* Stripe */}
                <Link
                  href="/integrations/payments/stripe"
                  target="_blank"
                  className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#635BFF] flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">Stripe</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Cards, 135+ currencies</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </Link>
                {/* Cashfree */}
                <Link
                  href="/integrations/payments/cashfree"
                  target="_blank"
                  className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-green-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#00B050] flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M11.66 3.655A8.344 8.344 0 0 0 3.656 12a8.344 8.344 0 0 0 8.004 8.345 8.167 8.167 0 0 0 6.697-3.414l-2.73-2.072a4.935 4.935 0 0 1-3.967 2.015A5.02 5.02 0 0 1 6.942 12a5.02 5.02 0 0 1 4.718-4.874 4.88 4.88 0 0 1 3.967 1.936l2.766-2.015a8.214 8.214 0 0 0-6.733-3.392z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">Cashfree</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Fast settlements, India</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </Link>
              </div>
            </CardContent>
          </Card>
            </motion.div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 outline-none">
            <motion.div variants={tabVariants} initial="hidden" animate="visible" className="space-y-6">
          <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates about your documents
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <Button onClick={() => toast.success("Notification preferences saved")}>
                Save Preferences
              </Button>
            </CardContent>
          </Card>
            </motion.div>
        </TabsContent>

        <TabsContent value="security" className="mt-6 outline-none">
            <motion.div variants={tabVariants} initial="hidden" animate="visible" className="space-y-6">
          <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-border/50">
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Two-factor authentication is not yet enabled for your account.
              </p>
              <Button variant="outline" disabled>
                Enable 2FA (Coming Soon)
              </Button>
            </CardContent>
          </Card>
            </motion.div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}

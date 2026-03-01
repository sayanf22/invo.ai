"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotificationsPage() {
  const router = useRouter()
  const user = useUser()

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
    }
  }, [user])

  const notifications = [
    {
      id: 1,
      type: "success",
      title: "Document Generated",
      message: "Your invoice has been successfully generated",
      time: "2 hours ago",
      read: false
    },
    {
      id: 2,
      type: "info",
      title: "New Feature Available",
      message: "Check out our new contract templates",
      time: "1 day ago",
      read: true
    },
    {
      id: 3,
      type: "warning",
      title: "Payment Reminder",
      message: "Your subscription renews in 3 days",
      time: "2 days ago",
      read: true
    }
  ]

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your account activity
          </p>
        </div>
        <Button variant="outline" size="sm">
          Mark all as read
        </Button>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <Card key={notification.id} className={notification.read ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{notification.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {notification.message}
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-2">
                    {notification.time}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {notifications.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No notifications</h3>
            <p className="text-muted-foreground">
              You're all caught up!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

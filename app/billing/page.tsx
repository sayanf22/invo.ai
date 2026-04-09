"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, CreditCard, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function BillingPage() {
  const router = useRouter()
  const user = useUser()

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
    }
  }, [user])

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      features: [
        "5 documents per month",
        "Basic templates",
        "Email support",
        "PDF export"
      ],
      current: true
    },
    {
      name: "Pro",
      price: "$29",
      period: "per month",
      features: [
        "Unlimited documents",
        "All templates",
        "Priority support",
        "All export formats",
        "Custom branding",
        "Priority support"
      ],
      current: false,
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "contact us",
      features: [
        "Everything in Pro",
        "Dedicated account manager",
        "Custom integrations",
        "SLA guarantee",
        "Advanced security",
        "Team collaboration"
      ],
      current: false
    }
  ]

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Plans</h1>
        <p className="text-muted-foreground">
          Choose the plan that's right for you
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are currently on the Free plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">Free Plan</p>
              <p className="text-sm text-muted-foreground">
                3 of 5 documents used this month
              </p>
            </div>
            <Button>Upgrade to Pro</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => (
          <Card 
            key={plan.name} 
            className={plan.popular ? "border-primary shadow-lg" : ""}
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.popular && (
                  <Badge className="bg-primary">
                    <Zap className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                )}
                {plan.current && (
                  <Badge variant="secondary">Current</Badge>
                )}
              </div>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground ml-2">/{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full" 
                variant={plan.current ? "outline" : "default"}
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>
            Manage your payment methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <CreditCard className="w-8 h-8 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">No payment method added</p>
              <p className="text-sm text-muted-foreground">
                Add a payment method to upgrade your plan
              </p>
            </div>
            <Button variant="outline">Add Card</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

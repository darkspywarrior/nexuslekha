import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RegisterUser } from "@shared/schema";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import TubesCursor from "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js";

      const canvas = document.getElementById('auth-tubes-canvas');
      if (canvas) {
        const app = TubesCursor(canvas, {
          tubes: {
            colors: ["#f967fb", "#53bc28", "#6958d5"],
            lights: {
              intensity: 200,
              colors: ["#83f36e", "#fe8a2e", "#ff008a", "#60aed5"]
            }
          }
        });
      }
    `;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const [loginData, setLoginData] = useState({
    gamertag: "",
  });

  const [registerData, setRegisterData] = useState<RegisterUser>({
    gamertag: "",
    firstName: "",
    lastName: "",
    email: "",
    age: undefined,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });

      window.location.href = "/";
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...registerData,
        age: registerData.age || undefined,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      toast({
        title: "Account created!",
        description: "Welcome to GameMatch!",
      });

      window.location.href = "/";
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <canvas id="auth-tubes-canvas" className="fixed inset-0 w-full h-full -z-10" />
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Gamepad2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">GameMatch</h1>
          </div>
          <p className="text-muted-foreground">Find your perfect gaming squad</p>
        </div>

        <Tabs defaultValue="register" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
            <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
          </TabsList>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Choose your gamertag to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-gamertag">
                      Gamertag <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="register-gamertag"
                      data-testid="input-register-gamertag"
                      placeholder="ProGamer123"
                      value={registerData.gamertag}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, gamertag: e.target.value })
                      }
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">
                      3-20 characters, must be unique
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-firstname">First Name</Label>
                      <Input
                        id="register-firstname"
                        data-testid="input-register-firstname"
                        placeholder="John"
                        value={registerData.firstName}
                        onChange={(e) =>
                          setRegisterData({ ...registerData, firstName: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-lastname">Last Name</Label>
                      <Input
                        id="register-lastname"
                        data-testid="input-register-lastname"
                        placeholder="Doe"
                        value={registerData.lastName}
                        onChange={(e) =>
                          setRegisterData({ ...registerData, lastName: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      data-testid="input-register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerData.email}
                      onChange={(e) =>
                        setRegisterData({ ...registerData, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-age">Age</Label>
                    <Input
                      id="register-age"
                      data-testid="input-register-age"
                      type="number"
                      placeholder="18"
                      min="13"
                      max="120"
                      value={registerData.age || ""}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          age: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-register-submit"
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>
                  Enter your gamertag to continue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-gamertag">Gamertag</Label>
                    <Input
                      id="login-gamertag"
                      data-testid="input-login-gamertag"
                      placeholder="ProGamer123"
                      value={loginData.gamertag}
                      onChange={(e) =>
                        setLoginData({ ...loginData, gamertag: e.target.value })
                      }
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login-submit"
                  >
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-muted-foreground mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

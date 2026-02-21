import { Tabs } from "expo-router";
import { View, Text, Image } from "react-native";
import { LayoutDashboard, CalendarCheck, CalendarDays, BookOpen, UserCircle, Sparkles } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";

export default function TabLayout() {
    const { user } = useAuth();
    const role = user?.role;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#FFFFFF",
                    borderTopColor: "#E5E7EB",
                    borderTopWidth: 1,
                    height: 70,
                    paddingBottom: 10,
                    paddingTop: 8,
                    elevation: 8,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                },
                tabBarActiveTintColor: "#0D9488",
                tabBarInactiveTintColor: "#9CA3AF",
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: "600",
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: role === "nurse" ? "Station" : role === "doctor" ? "Dashboard" : "Home",
                    tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="appointments"
                options={{
                    title: "Appts",
                    tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="learn"
                options={{
                    title: "Learn",
                    tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="events"
                options={{
                    title: "Events",
                    tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="analyzer"
                options={{
                    title: "AI Scan",
                    tabBarIcon: ({ color, size, focused }) => (
                        <Image
                            source={require("../../assets/icon.png")}
                            style={{
                                width: size,
                                height: size,
                                opacity: focused ? 1 : 0.5,
                                borderRadius: 4,
                            }}
                            resizeMode="contain"
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => <UserCircle size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}

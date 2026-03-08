import { Tabs } from 'expo-router';
import Icon from '../../components/Icon';
import { COLORS } from '../../constants/colors';

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.bgCard,
                    borderTopColor: COLORS.bgBorder,
                    height: 64,
                    paddingBottom: 8,
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textDim,
                tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
            }}
        >
            <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} /> }} />
            <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color, size }) => <Icon name="briefcase" size={size} color={color} /> }} />
            <Tabs.Screen name="roadmap" options={{ title: 'Roadmap', tabBarIcon: ({ color, size }) => <Icon name="map" size={size} color={color} /> }} />
            <Tabs.Screen name="interview" options={{ title: 'Interview', tabBarIcon: ({ color, size }) => <Icon name="mic" size={size} color={color} /> }} />
            <Tabs.Screen name="study" options={{ title: 'Study AI', tabBarIcon: ({ color, size }) => <Icon name="chatbubbles" size={size} color={color} /> }} />
            <Tabs.Screen name="leaderboard" options={{ title: 'Ranks', tabBarIcon: ({ color, size }) => <Icon name="trophy" size={size} color={color} /> }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Icon name="person" size={size} color={color} /> }} />
        </Tabs>
    );
}

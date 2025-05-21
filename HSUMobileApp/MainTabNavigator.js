// MainTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import EventScreen from './screens/EventScreen';
import NotificationScreen from './screens/NotificationScreen';
import AccountSettingsScreen from './screens/AccountSettings';
import HomeStackNavigator from './Navigation/HomeStackNavigator';


const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Trang chủ"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#002366',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          paddingBottom: 5,
          height: 60,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Trang chủ':
              iconName = 'home';
              break;
            case 'Sự kiện':
              iconName = 'calendar-alt';
              break;
            case 'Thông báo':
              iconName = 'bell';
              break;
            case 'Khác':
              iconName = 'user-cog';
              break;
              default: iconName = 'question-circle';
               break;
              }

          return <FontAwesome5 name={iconName} size={20} color={color} solid />;
        },
      })}
    >
      <Tab.Screen name="Trang chủ" component={HomeStackNavigator} />
      <Tab.Screen name="Sự kiện" component={EventScreen} />
      <Tab.Screen name="Thông báo" component={NotificationScreen} />
      <Tab.Screen name="Khác" component={AccountSettingsScreen} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;

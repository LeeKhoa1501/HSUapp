import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      {/* <Stack.Screen name="Booking" component={BookingScreen} options={{ title: "Đặt phòng" }} />
      <Stack.Screen name="Timetable" component={TimetableScreen} options={{title:"Thời khóa"}}></Stack.Screen> */}
    </Stack.Navigator>
  );
}

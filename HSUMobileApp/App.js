// App.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../HSUMobileApp/screens/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BookingScreen from './screens/BookingScreen';
import HandbookScreen from './screens/HandbookScreen';
import TimetableScreen from './screens/TimetableScreen';
import ExamScheduleScreen from './screens/ExamScheduleScreen';
import GradesScreen from './screens/GradeSrceen';
import AttendanceScreen from './screens/AttendanceScreen';
import TuitionScreen from './screens/TuitionScreen';
import ChuyenCanScreen from './screens/ChuyenCanScreen';
import EvaluationListScreen from './screens/EvaluationListScreen';
import EvaluationFormScreen from './screens/EvaluationFormScreen';

import StudyPlanScreen from './screens/StudyPlanScreen';
import AddCourseToPlanScreen from './screens/AddCourseToPlanScreen';

import AcademicRequestListScreen from './screens/AcademicRequestListScreen';
import AcademicRequestFormScreen from './screens/AcademicRequestFormScreen';
import AcademicRequestDetailScreen from './screens/AcademicRequestDetailScreen';

import InternshipListScreen from './screens/InternshipListScreen';
import InternshipFormScreen from './screens/InternshipFormScreen';
import InternshipDetailScreen from './screens/InternshipDetailScreen';

import EditFavoriteFunctionsScreen from './screens/EditFavoriteFunctionsScreen';
import PhotoAccountScreen from './screens/PhotoAccountScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Handbook" component={HandbookScreen} 
          options={{
            headerShown:true,
            title:'Sổ tay sinh viên',
            headerStyle:{backgroundColor:'#002366'},
            headerTintColor:'#fff',
          }}/>


          <Stack.Screen name="Booking" component={BookingScreen}
            options={{
              headerShown: true, 
              title: 'Đặt phòng', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',             
            }}
          />

          <Stack.Screen name="StudyPlan" component={StudyPlanScreen}
          options={{
            headerShown: true, 
            title: 'Kế hoạch HTCN', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />
          
          <Stack.Screen name="PhotoAccountScreen" component={PhotoAccountScreen}
          options={{
            headerShown: true, 
            title: 'Tài Khoản Photo', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />
          
          <Stack.Screen name="EditFavoriteFunctions" component={EditFavoriteFunctionsScreen}
          options={{
            headerShown: true, 
            title: 'Tùy chỉnh Ưa thích', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />

          <Stack.Screen name="AddCourseToPlan" component={AddCourseToPlanScreen}
          options={{
            headerShown: true, 
            title: 'Thêm môn vào Kế hoạch', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />
          
          <Stack.Screen name="AcademicRequestList" component={AcademicRequestListScreen}
          options={{
            headerShown: true, 
            title: 'Yêu cầu Học vụ', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />

          <Stack.Screen name="AcademicRequestFormScreen" component={AcademicRequestFormScreen}
          options={{
            headerShown: true, 
            title: 'Tạo Yêu cầu Mới', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />

          <Stack.Screen name="AcademicRequestDetailScreen" component={AcademicRequestDetailScreen}
          options={{
            headerShown: true, 
            title: 'Chi tiết Yêu cầu HV', 
            headerStyle: { backgroundColor: '#002366' }, 
            headerTintColor: '#fff',             
          }}
          />

          <Stack.Screen name="ChuyenCan" component={ChuyenCanScreen}
            options={{
              headerShown: true, 
              title: 'Chuyên Cần', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',             
            }}
          />

          <Stack.Screen name="EvaluationList" component={EvaluationListScreen}
            options={{
              headerShown: true, 
              title: 'Đánh giá Môn học', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',             
            }}
          />

          <Stack.Screen name="EvaluationForm" component={EvaluationFormScreen}
            options={{
              headerShown: true, 
              title: 'Đánh giá Môn học', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',             
            }}
          />

          <Stack.Screen name="Timetable" component={TimetableScreen}
            options={{
              headerShown: true, 
              title: 'Thời khoá biểu', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',             
            }}
          />

          <Stack.Screen name="tuition" component={TuitionScreen}
            options={{
              headerShown: true, 
              title: 'Thông tin học phí', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',             
            }}
          />

          <Stack.Screen name="InternshipList" component={InternshipListScreen}
            options={{ 
              headerShown: true,
              title: 'Đăng Ký Thực Tập',
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',
            }}
          />
          <Stack.Screen name="InternshipFormScreen" component={InternshipFormScreen}
            options={{
              headerShown: true,
              title: 'Tạo Đơn Thực Tập' ,
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',
            }}
          />
          <Stack.Screen name="InternshipDetailScreen" component={InternshipDetailScreen}
            options={{
              headerShown: true,
              title: 'Chi Tiết Đơn Thực Tập',
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',
            }}
          />

          <Stack.Screen name='attendance' component={AttendanceScreen}
          options={{
            headerShown: true, 
              title: 'Điểm Danh', 
              headerStyle: { backgroundColor: '#002366' }, 
              headerTintColor: '#fff',
          }}></Stack.Screen>

          <Stack.Screen name='ExamSchedule' component={ExamScheduleScreen}
          options={{
            headerShown:true,
            title:'Lịch thi',
            headerStyle:{backgroundColor:'#002366'},
            headerTintColor:'#fff',
          }}></Stack.Screen>

          <Stack.Screen name='Grades' component={GradesScreen}
          options={{
            headerShown:true,
            title:'Kết quả học tập',
            headerStyle:{backgroundColor:'#002366'},
            headerTintColor:'#fff',
          }}></Stack.Screen>
          
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
// screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

// !!! KIỂM TRA LẠI IP NÀY !!!
const API_BASE_URL = 'http://10.101.38.213:5000';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu.'); return; }
    setIsLoading(true);
    console.log(`LOGIN: Attempting login for ${email} with password ${password.length > 0 ? 'provided' : 'empty'}`); // Log trước khi gọi API
    try {
       const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase(), password }), // Gửi pass gốc
       });
       const data = await response.json();
       console.log("LOGIN: API Response Status:", response.status);
       console.log("LOGIN: API Response Data:", data);

       if (response.ok && data.success) {
           Alert.alert("✅ Đăng nhập thành công", `Chào mừng ${data.data?.fullName || ''}!`);
           if (data.token) { await AsyncStorage.setItem('userToken', data.token); }
           if (data.data) { await AsyncStorage.setItem('userData', JSON.stringify(data.data)); }
           navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
       } else {
            Alert.alert("❌ Đăng nhập thất bại", data.message || "Email hoặc mật khẩu không đúng.");
       }
    } catch (err) {
        console.error("LOGIN: Lỗi gọi API login:", err);
        if (err.message === 'Network request failed') { Alert.alert("Lỗi mạng", "Không thể kết nối đến server."); }
        else { Alert.alert("Lỗi", "Đã có lỗi xảy ra."); }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/hsulogo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.header}>Đăng nhập HSU</Text>
      <TextInput style={styles.input} placeholder="Email sinh viên (@hsu.edu.vn)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#aaa" />
      <TextInput style={styles.input} placeholder="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#aaa" />
      <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? (<ActivityIndicator size="small" color="#fff" />) : (<Text style={styles.buttonText}>Đăng nhập</Text>)}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
    container:{flex:1,justifyContent:'center',alignItems:'center',padding:30,backgroundColor:'#fff'},logo:{width:180,height:90,marginBottom:30},header:{fontSize:24,fontWeight:'bold',marginBottom:25,color:'#002366'},input:{width:'100%',backgroundColor:'#f0f4f8',borderWidth:1,borderColor:'#d0d8e0',padding:15,borderRadius:12,marginBottom:18,fontSize:16,color:'#333'},button:{backgroundColor:'#002366',padding:16,borderRadius:12,width:'100%',alignItems:'center',marginTop:10,shadowColor:"#000",shadowOffset:{width:0,height:2},shadowOpacity:.15,shadowRadius:3.84,elevation:3},buttonDisabled:{backgroundColor:'#a0b4d4'},buttonText:{color:'#fff',fontWeight:'600',fontSize:16}
});

export default LoginScreen;
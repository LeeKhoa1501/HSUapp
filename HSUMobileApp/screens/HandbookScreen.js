// screens/HandbookScreen.js
import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview'; // Import WebView
import { SafeAreaView } from 'react-native-safe-area-context';

const HANDBOOK_URL = 'https://www.hoasen.edu.vn/so-tay-sinh-vien/';

const HandbookScreen = () => {

  // Hàm render khi WebView đang load
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#002366" />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <WebView
        source={{ uri: HANDBOOK_URL }} // Đặt URL cần hiển thị
        style={styles.webView}
        startInLoadingState={true} // Hiển thị loading indicator mặc định của WebView
        renderLoading={renderLoading} // Hoặc dùng custom loading indicator
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
          // Có thể hiển thị thông báo lỗi cho người dùng ở đây
          // Alert.alert('Lỗi', 'Không thể tải sổ tay sinh viên.');
        }}
        // Cho phép JavaScript chạy trong webview (nếu cần)
        // javaScriptEnabled={true}
        // Cho phép DOM storage (nếu cần)
        // domStorageEnabled={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff', // Màu nền cho khu vực an toàn
  },
  webView: {
    flex: 1, // Đảm bảo WebView chiếm hết không gian
  },
  loadingContainer: { // Style cho loading indicator (nếu dùng renderLoading)
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)' // Nền hơi mờ
  },
});

export default HandbookScreen;
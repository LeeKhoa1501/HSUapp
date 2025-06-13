// screens/TuitionScreen.js
import React, { useState, useEffect, useCallback } from 'react'; // Thêm lại các hook
import {ScrollView,View,Text,StyleSheet,TouchableOpacity,Image,ActivityIndicator,Alert,RefreshControl,FlatList} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native'; // Thêm lại useFocusEffect nếu cần
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

const API_BASE_URL = 'http://10.101.39.47:5000'; // <-- Kiểm tra IP/URL

// --- Hàm format tiền tệ ---
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString('vi-VN') + ' đ';
};

// --- Hàm format ngày ---
const formatDate = (dateString) => {
     if (!dateString) return 'N/A';
     try {
         const date = new Date(dateString);
         if (isNaN(date.getTime())) return 'N/A';
         return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
     } catch (e) { return 'N/A'; }
 };

// --- Component hiển thị thông tin một ngân hàng ---
const BankInfoCard = React.memo(({ bankName, branch, accountName, accountNumber }) => (
    <View style={styles.infoCard}>
        <Text style={styles.bankName}>{bankName || 'N/A'}</Text>
        {branch && <Text style={styles.branchName}>{branch}</Text>}
        <View style={styles.accountRow}><Text style={styles.accountLabel}>Tên tài khoản:</Text><Text style={styles.accountValue}>{accountName || 'N/A'}</Text></View>
        <View style={styles.accountRow}><Text style={styles.accountLabel}>Số tài khoản:</Text><Text style={styles.accountValue}>{accountNumber || 'N/A'}</Text></View>
    </View>
));

// --- Component hiển thị chi tiết học phí một kỳ ---
const TuitionSemesterCard = React.memo(({ item }) => {
    const amountRemaining = (item?.amountDue ?? 0) - (item?.amountPaid ?? 0);
    let statusText = 'N/A';
    let statusColor = '#6c757d'; // Default gray
    switch (item?.status) { case 'Paid': statusText = 'Đã đóng đủ'; statusColor = '#28a745'; break; case 'Unpaid': statusText = 'Chưa đóng'; statusColor = '#dc3545'; break; case 'Partially Paid': statusText = 'Đã đóng một phần'; statusColor = '#ffc107'; break; case 'Overdue': statusText = 'Quá hạn'; statusColor = '#dc3545'; break; }

    return (
        <View style={styles.tuitionCard}>
            <View style={styles.semesterTitleContainer}>
                 <Text style={styles.semesterTitle}>{item?.semester} ({item?.academicYear})</Text>
                 <View style={[styles.statusBadge, {backgroundColor: statusColor}]}><Text style={styles.statusText}>{statusText}</Text></View>
            </View>
             <View style={styles.feeRow}><Text style={styles.feeLabel}>Số tiền phải đóng:</Text><Text style={styles.feeValue}>{formatCurrency(item?.amountDue)}</Text></View>
             <View style={styles.feeRow}><Text style={styles.feeLabel}>Đã đóng:</Text><Text style={[styles.feeValue, styles.paidValue]}>({formatCurrency(item?.amountPaid)})</Text></View>
             <View style={styles.feeRow}><Text style={styles.feeLabel}>Còn lại:</Text><Text style={[styles.feeValue, amountRemaining > 0 && styles.dueValue]}>{formatCurrency(amountRemaining)}</Text></View>
             <View style={styles.feeRow}><Text style={styles.feeLabel}>Hạn đóng:</Text><Text style={styles.feeValue}>{formatDate(item?.dueDate)}</Text></View>
        </View>
    );
});

// ===========================================
// === COMPONENT CHÍNH: TuitionScreen ========
// ===========================================
const TuitionScreen = () => {
    const navigation = useNavigation();
    // --- Thêm lại State Variables ---
    const [userInfo, setUserInfo] = useState(null);
    const [tuitionHistory, setTuitionHistory] = useState([]); // State lưu lịch sử học phí
    const [isLoading, setIsLoading] = useState(true);      // State loading chung
    const [error, setError] = useState(null);           // State lưu lỗi fetch
    const [refreshing, setRefreshing] = useState(false);     // State cho pull-to-refresh

    // --- Hàm Fetch Thông tin User ---
    const fetchUserInfo = useCallback(async () => {
        // Chỉ fetch user info nếu chưa có
        if (userInfo) return;
        console.log('[TuitionScreen] Fetching user info...');
        let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) { console.warn('[TuitionScreen] No token found for user info fetch.'); return; }
            const apiUrl = `${API_BASE_URL}/api/auth/me`;
            const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            let result = JSON.parse(await response.text());
            if (response.ok && result.success && result.data) { setUserInfo(result.data); }
            else { console.error('[TuitionScreen] Failed to fetch user info:', result.message || `Status ${response.status}`);}
        } catch (err) { console.error('[TuitionScreen] Error fetching user info:', err); }
    }, [userInfo]); // Phụ thuộc userInfo

    // --- Hàm Fetch Lịch sử học phí ---
    const fetchTuitionData = useCallback(async (isRefreshing = false) => {
        // Nếu không phải đang refresh và chưa loading thì mới bật loading chính
        if (!isRefreshing && !isLoading) setIsLoading(true);
        setError(null); // Reset lỗi
        console.log('[TuitionScreen] Fetching tuition history...');
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error('Token không tồn tại. Vui lòng đăng nhập lại.');
            const apiUrl = `${API_BASE_URL}/api/tuition/my`; // <-- API Học phí
            console.log(`[TuitionScreen] Calling Tuition API: ${apiUrl}`);
            const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            let result = JSON.parse(await response.text()); // Cần try-catch kỹ hơn
            console.log(`[TuitionScreen] Tuition API Status: ${response.status}`);

            if (response.ok && result.success && Array.isArray(result.data)) {
                setTuitionHistory(result.data || []); // Cập nhật state lịch sử
                console.log(`[TuitionScreen] Fetched ${result.count ?? 0} tuition records.`);
            } else {
                 console.error('[TuitionScreen] Tuition API Error:', result);
                 throw new Error(result.message || `Lỗi ${response.status} khi tải học phí`);
            }
        } catch (err) {
            console.error('[TuitionScreen] Error fetching tuition:', err);
            setError(err.message || "Lỗi không xác định."); // Set lỗi
            setTuitionHistory([]); // Reset khi lỗi
            if (String(err.message).includes('Token')) { Alert.alert("Phiên hết hạn", "Vui lòng đăng nhập lại.", [{ text: "OK", onPress: () => navigation.replace('Login') }]); }
        } finally {
             // Tắt loading chính sau khi cả 2 fetch (user và tuition) hoàn thành hoặc lỗi
             // Nếu chỉ gọi fetch này khi refresh thì chỉ tắt refreshing
             if (!isRefreshing) setIsLoading(false);
             setRefreshing(false);
        }
    }, [navigation]); // Phụ thuộc navigation

    // --- Fetch user và học phí khi màn hình focus ---
     // Chạy fetchUserInfo và fetchTuitionData khi màn hình được focus
    useFocusEffect(
        useCallback(() => {
            console.log("[TuitionScreen] Screen Focused. Fetching data...");
            setIsLoading(true); // Bật loading khi bắt đầu fetch
            Promise.all([fetchUserInfo(), fetchTuitionData()]) // Gọi cả hai song song
                   .catch(e => console.error("Error during initial fetch:", e)) // Bắt lỗi tổng
                   .finally(() => setIsLoading(false)); // Tắt loading chính sau khi cả hai xong
        }, [fetchUserInfo, fetchTuitionData]) // Phụ thuộc vào hai hàm fetch
    );


    // --- Kéo refresh ---
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // Fetch lại cả user info và tuition data
        Promise.all([fetchUserInfo(true), fetchTuitionData(true)])
               .finally(() => setRefreshing(false));
    }, [fetchUserInfo, fetchTuitionData]);


    // --- Dữ liệu ngân hàng tĩnh ---
    const bankInfo1 = { bankName: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)', branch: 'Chi nhánh Sở Giao dịch 2', accountName: 'TRƯỜNG ĐẠI HỌC HOA SEN', accountNumber: '1303 072 458' };
    const bankInfo2 = { bankName: 'Ngân hàng TMCP Hàng Hải Việt Nam - Maritime Bank (MSB)', branch: 'Chi nhánh TP. HCM', accountName: 'TRƯỜNG ĐẠI HỌC HOA SEN', accountNumber: '0400 1010 091963' };

    // --- Phần render Loading ---
    const renderLoading = () => (
        <View style={styles.centeredMessage}>
            <ActivityIndicator size="large" color="#002366" />
            <Text style={styles.loadingText}>Đang tải thông tin học phí...</Text>
        </View>
    );

    // --- Phần render Lỗi ---
     const renderError = () => (
         <View style={styles.centeredMessage}>
             <FontAwesome5 name="exclamation-circle" size={40} color="#e63946" />
             <Text style={styles.errorText}>Không thể tải dữ liệu</Text>
             <Text style={styles.errorDetailText}>{error}</Text>
             <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                 <Text style={styles.retryButtonText}>Thử lại</Text>
             </TouchableOpacity>
         </View>
     );

     // --- Phần render Nội dung chính ---
     const renderContent = () => (
         <ScrollView
             style={styles.scrollView}
             contentContainerStyle={styles.scrollContent}
             showsVerticalScrollIndicator={false}
             refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]} tintColor={"#002366"} />}
         >
              {/* Thông tin Sinh viên */}
              {userInfo && (
                  <View style={styles.studentInfoBanner}>
                       <Text style={styles.studentInfoText}>{userInfo.studentId || 'N/A'} - {userInfo.fullName || 'N/A'}</Text>
                  </View>
              )}
              {/* Thông tin ngân hàng */}
              <View style={styles.sectionContainer}>
                   <Text style={styles.sectionTitle}>Thông tin tài khoản Ngân hàng</Text>
                   <BankInfoCard {...bankInfo1} />
                   <BankInfoCard {...bankInfo2} />
              </View>
              {/* Mã QR */}
              <View style={styles.sectionContainer}>
                   <Text style={styles.sectionTitle}>Quét mã VietQR / Napas247</Text>
                   <View style={styles.qrCard}>
                        <Image source={require('../assets/images/VietQR.png')} style={styles.vietQrLogo} resizeMode="contain" />
                   </View>
              </View>
              {/* Lịch sử học phí */}
              <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Lịch sử học phí</Text>
                  {tuitionHistory.length === 0 && !isLoading && !refreshing ? ( // Kiểm tra cả refreshing
                      <Text style={styles.emptyText}>Chưa có thông tin học phí.</Text>
                  ) : (
                      <FlatList
                          data={tuitionHistory}
                          renderItem={({ item }) => <TuitionSemesterCard item={item} />}
                          keyExtractor={(item) => item._id ? item._id.toString() : `${item.academicYear}-${item.semester}`}
                          scrollEnabled={false} // Không cho cuộn vì đã có ScrollView cha
                      />
                  )}
                  {/* Hiển thị loading nhỏ khi đang refresh */}
                  {refreshing && <ActivityIndicator size="small" color="#002366" style={{marginTop: 15}} />}
              </View>
         </ScrollView>
     );

    // --- UI Chính ---
    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            {isLoading ? renderLoading() : error ? renderError() : renderContent()}
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 30, paddingTop: 20 },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#6c757d' },
    errorText: { marginTop: 15, fontSize: 17, fontWeight: '600', color: '#e63946', textAlign: 'center' },
    errorDetailText: { marginTop: 5, fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#1d3557', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 8, elevation: 2, shadowOpacity: 0.1 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    sectionContainer: { marginHorizontal: 15, marginBottom: 25, },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#003366', marginBottom: 12, },
    studentInfoBanner: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: "#ccc", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, alignItems: 'center', marginBottom: 25, marginHorizontal: 15 },
    studentInfoText: { fontSize: 16, fontWeight: 'bold', color: '#003366' },
    infoCard: { backgroundColor: '#fff', marginBottom: 12, padding: 15, borderRadius: 8, elevation: 2, shadowColor: "#ccc", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, borderWidth: 1, borderColor: '#eee', },
    bankName: { fontSize: 15, fontWeight: 'bold', color: '#1d3557', marginBottom: 4 },
    branchName: { fontSize: 14, color: '#555', marginBottom: 8 },
    accountRow: { flexDirection: 'row', marginTop: 6 },
    accountLabel: { fontSize: 14, color: '#666', width: 110 },
    accountValue: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1 },
    qrCard: { backgroundColor: '#fff', paddingVertical: 25, paddingHorizontal: 20, borderRadius: 8, elevation: 2, alignItems: 'center', shadowColor: "#ccc", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, borderWidth: 1, borderColor: '#eee', },
    vietQrLogo: { height: 200, width: 250, marginBottom: 20 },
    qrCodeImage: { width: 250, height: 250, marginBottom: 25, borderWidth: 1, borderColor: '#eee' }, // Kích thước QR lớn hơn
    // --- Styles cho Lịch sử học phí ---
    tuitionListContainer: { /* Style cho View bao ngoài nếu cần */ },
    tuitionCard: { backgroundColor: '#fff', borderRadius: 8, marginBottom: 15, padding: 15, elevation: 2, shadowColor: "#ccc", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, borderWidth: 1, borderColor: '#eee', },
    semesterTitleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', },
    semesterTitle: { fontSize: 15, fontWeight: 'bold', color: '#e63946' }, // Màu đỏ cho học kỳ
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 5 }, // Thêm marginLeft
    statusText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
    feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
    feeLabel: { fontSize: 14, color: '#555' },
    feeValue: { fontSize: 14, fontWeight: '500', color: '#333' },
    paidValue: { color: '#888' }, // Màu xám cho số tiền đã đóng
    dueValue: { color: '#dc3545', fontWeight: 'bold' }, // Màu đỏ cho số tiền còn lại > 0
    emptyText: { marginTop: 30, fontSize: 16, color: '#6c757d', textAlign: 'center', fontStyle: 'italic' }, // Style cho thông báo rỗng
});

export default TuitionScreen;
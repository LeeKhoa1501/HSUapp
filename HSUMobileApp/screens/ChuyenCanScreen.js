// HSUMobileApp/screens/ChuyenCanScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, StyleSheet, ActivityIndicator,
    RefreshControl, Alert, TouchableOpacity
} from 'react-native';
import { API_BASE_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';

// --- API URL (Giống màn hình AttendanceScreen) ---
const BASE_URL = API_BASE_URL; // <-- IP Backend

// --- Component con: Hiển thị một môn học có vấn đề ---
const ProblematicCourseItem = React.memo(({ item }) => {
    // Xác định mức độ cảnh báo (ví dụ)
    const isAbsentWarning = (item?.absentCount ?? 0) >= 2; // Vắng >= 2 buổi
    const isLateWarning = (item?.lateCount ?? 0) >= 3; // Trễ >= 3 buổi
    const warningLevel = isAbsentWarning ? 'high' : (isLateWarning ? 'medium' : 'low'); // Chỉ cần có vắng/trễ là low
    return (
        <View style={[styles.itemCard,
            warningLevel === 'high' ? styles.cardWarningHigh : (warningLevel === 'medium' ? styles.cardWarningMedium : styles.cardWarningLow)
        ]}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemCourseName} numberOfLines={2}>{item?.courseName || 'N/A'}</Text>
                <Text style={styles.itemSemester}>{item?.semesterTitle || 'N/A'}</Text>
            </View>
            <Text style={styles.itemCourseCode}>{item?.courseCode || 'N/A'}</Text>
            <View style={styles.itemStatsRow}>
                <View style={styles.itemStat}>
                     <FontAwesome5 name="calendar-times" size={14} color="#dc3545" />
                     <Text style={styles.statText}> Vắng KP: <Text style={styles.statValueAbsent}>{item?.absentCount ?? '-'}</Text></Text>
                 </View>
                 <View style={styles.itemStat}>
                      <FontAwesome5 name="clock" size={14} color="#ffc107" />
                      <Text style={styles.statText}> Đi trễ: <Text style={styles.statValueLate}>{item?.lateCount ?? '-'}</Text></Text>
                  </View>
            </View>
            {/* Có thể thêm nút để nhảy qua màn hình AttendanceScreen xem chi tiết kỳ đó nếu muốn */}
            {/* <TouchableOpacity onPress={() => navigateToDetail(item.semesterTitle, item.courseId)}>
                 <Text>Xem chi tiết kỳ</Text>
             </TouchableOpacity> */}
        </View>
    );
});


// === COMPONENT CHÍNH: ChuyenCanScreen =====
const ChuyenCanScreen = () => {
    const navigation = useNavigation();
    // --- States ---
    const [problematicCourses, setProblematicCourses] = useState([]); // Chỉ lưu các môn có vắng > 0 hoặc trễ > 0
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    // --- Ref ---
    const isFetchingRef = useRef(false);

    // --- Hàm Lọc và Chuẩn bị dữ liệu ---
    const processAndFilterData = useCallback((allData) => {
        if (!Array.isArray(allData)) return [];
        const problems = [];
        allData.forEach(semesterSection => {
            const semesterTitle = semesterSection.title || 'Không rõ kỳ'; // Lấy tên kỳ
            if (Array.isArray(semesterSection.data)) {
                semesterSection.data.forEach(course => {
                    // Điều kiện lọc: Có Vắng KP hoặc Đi trễ
                    if ((course.absentCount ?? 0) > 0 || (course.lateCount ?? 0) > 0) {
                        problems.push({
                            ...course, // Giữ lại các thông tin của course
                            semesterTitle: semesterTitle, // Thêm thông tin kỳ học
                            uniqueKey: `${semesterTitle}-${course.courseId}` // Tạo key duy nhất cho FlatList
                        });
                    }
                });
            }
        });
        // Sắp xếp: Ưu tiên môn có số buổi vắng cao hơn, sau đó đến số buổi trễ
        problems.sort((a, b) => (b.absentCount ?? 0) - (a.absentCount ?? 0) || (b.lateCount ?? 0) - (a.lateCount ?? 0));
        return problems;
    }, []);

    // --- Hàm fetch dữ liệu TỔNG HỢP (Tái sử dụng API summary) ---
    const fetchAttendanceOverview = useCallback(async (isRefreshing = false) => {
        if (isFetchingRef.current && !isRefreshing) { if(isRefreshing) setRefreshing(false); return; }
        isFetchingRef.current = true;
        if (!isRefreshing) setIsLoading(true); setError(null);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error('...');
            const apiUrl = `${API_BASE_URL}/api/attendance/summary`; // <<< VẪN DÙNG API NÀY
            const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });

            // --- Xử lý response (kiểm tra lỗi HTML, parse JSON) ---
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                 let result = await response.json();
                 if (response.ok && result.success && Array.isArray(result.data)) {
                      // Lọc dữ liệu ngay sau khi fetch thành công
                      const filteredProblems = processAndFilterData(result.data);
                      setProblematicCourses(filteredProblems);
                 } else { throw new Error(result.message || `Lỗi ${response.status}`); }
             } else {
                 let errorText = await response.text();
                 console.error("Received non-JSON response for Overview:", errorText);
                 throw new Error(`Lỗi Server hoặc API Summary không đúng (Received ${contentType})`);
             }
        } catch (err) { setError(err.message); setProblematicCourses([]); if (String(err.message).includes('Token')) { /*...*/ }}
        finally { if (!isRefreshing) setIsLoading(false); setRefreshing(false); isFetchingRef.current = false; }
    }, [navigation, processAndFilterData]); // Thêm processAndFilterData dependency

    // --- Fetch lần đầu ---
     useEffect(() => { fetchAttendanceOverview(); }, [fetchAttendanceOverview]); // Gọi khi component mount

    // --- Kéo refresh ---
    const onRefresh = useCallback(() => { setRefreshing(true); fetchAttendanceOverview(true); }, [fetchAttendanceOverview]);

    // --- UI Chính ---
    return (
        <SafeAreaView style={styles.safeArea}>
             {/* Header của Stack Navigator (Title: "Chuyên cần") */}

             {isLoading ? ( /* Loading ban đầu */
                <View style={styles.centeredMessage}><ActivityIndicator size="large" color="#003366" /></View>
             ) : error ? ( /* Error */
                <View style={styles.centeredMessage}><FontAwesome5 name="exclamation-circle" size={40} color="#e63946" /><Text style={styles.errorText}>Không thể tải dữ liệu</Text><Text style={styles.errorDetailText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => fetchAttendanceOverview()}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></View>
             ) : ( /* Nội dung chính: Dùng FlatList */
                 <FlatList
                     data={problematicCourses}
                     renderItem={({ item }) => <ProblematicCourseItem item={item} />}
                     keyExtractor={(item) => item.uniqueKey} // Dùng key đã tạo
                     contentContainerStyle={styles.listContainer}
                     showsVerticalScrollIndicator={false}
                     refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#003366"]} tintColor={"#003366"} /> }
                     ListHeaderComponent={ // Tiêu đề cho danh sách
                         <Text style={styles.listHeader}>Các môn học cần chú ý chuyên cần</Text>
                     }
                     ListEmptyComponent={ // Khi không có môn nào có vấn đề
                         !isLoading && !refreshing ? (<View style={styles.centeredMessage}><FontAwesome5 name="check-circle" size={40} color="#28a745" /><Text style={styles.emptyText}>Chúc mừng! Bạn không có môn học nào có vấn đề về chuyên cần.</Text></View>) : null
                     }
                 />
             )}
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f4f7f9' }, // Nền hơi xám
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25, marginTop: 30 },
    errorText: { marginTop: 15, fontSize: 17, fontWeight: '600', color: '#e63946', textAlign: 'center' },
    errorDetailText: { marginTop: 5, fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#1d3557', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 8, elevation: 2, shadowOpacity: 0.1 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    emptyText: { marginTop: 15, fontSize: 16, color: '#28a745', textAlign:'center', fontWeight: '500' },
    listContainer: { paddingHorizontal: 12, paddingBottom: 20, paddingTop: 10 },
    listHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#003366', paddingHorizontal: 5, textAlign: 'center' },
    itemCard: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        marginBottom: 12,
        padding: 15,
        shadowColor: "#ccc",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
        borderLeftWidth: 5, // Viền trái để thể hiện mức độ cảnh báo
    },
    cardWarningLow: { borderLeftColor: '#17a2b8' }, // Màu xanh nhạt cho có vấn đề nhẹ
    cardWarningMedium: { borderLeftColor: '#ffc107' }, // Vàng cho trễ nhiều
    cardWarningHigh: { borderLeftColor: '#dc3545' }, // Đỏ cho vắng nhiều
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
    itemCourseName: { flex: 1, fontSize: 15.5, fontWeight: 'bold', color: '#003366', marginRight: 10 },
    itemSemester: { fontSize: 12, color: '#6c757d', fontStyle: 'italic' },
    itemCourseCode: { fontSize: 12.5, color: '#666', marginBottom: 10 },
    itemStatsRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    itemStat: { flexDirection: 'row', alignItems: 'center', marginRight: 20 }, // Cách nhau ra
    statText: { marginLeft: 6, fontSize: 14, color: '#333' },
    statValueAbsent: { fontWeight: 'bold', color: '#dc3545' },
    statValueLate: { fontWeight: 'bold', color: '#ffc107' },
});

export default ChuyenCanScreen;
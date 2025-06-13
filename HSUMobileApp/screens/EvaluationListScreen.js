// screens/EvaluationListScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Thêm useRef
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios'; 
import { API_BASE_URL } from '@env';

const BASE_URL = API_BASE_URL;

// Component hiển thị một môn học trong danh sách
const CourseItem = React.memo(({ item, onPress }) => (
    <TouchableOpacity style={styles.courseItem} onPress={onPress}>
        <View style={styles.courseInfo}>
            <Text style={styles.courseName} numberOfLines={2}>{item.courseName || 'N/A'}</Text>
            <Text style={styles.courseDetails}>{item.courseCode || 'N/A'} - {item.semester} ({item.academicYear})</Text>
            {/* Có thể hiển thị tên GV ở đây nếu API trả về */}
            {/* <Text style={styles.instructorName}>GV: {item.instructorName || 'N/A'}</Text> */}
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#ccc" />
    </TouchableOpacity>
));

const EvaluationListScreen = () => {
    const navigation = useNavigation();
    const [evaluatableCourses, setEvaluatableCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch danh sách môn có thể đánh giá
    const fetchEvaluable = useCallback(async (isRefreshing = false) => {
        if (!isRefreshing) setIsLoading(true);
        setError(null);
        console.log("[EvalList] Fetching evaluatable courses...");
        let token;
        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) throw new Error("Token không hợp lệ.");

            const response = await axios.get(`${BASE_URL}/api/evaluations/evaluatable`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data?.success && Array.isArray(response.data.data)) {
                 console.log(`[EvalList] Found ${response.data.data.length} courses.`);
                setEvaluatableCourses(response.data.data);
            } else {
                throw new Error(response.data?.message || "Không thể tải danh sách.");
            }
        } catch (err) {
            console.error("[EvalList] Fetch Error:", err.response?.data || err.message);
            setError(err.response?.data?.message || err.message || "Lỗi tải dữ liệu.");
            setEvaluatableCourses([]); // Xóa dữ liệu cũ nếu lỗi
            if (String(err.message).includes('Token') || err.response?.status === 401) {
                Alert.alert("Lỗi", "Phiên đăng nhập hết hạn.", [{ text: "OK", onPress: () => navigation.replace('Login') }]);
            }
        } finally {
            if (!isRefreshing) setIsLoading(false);
            setRefreshing(false);
        }
    }, [navigation]);

    // Fetch khi màn hình focus
    useFocusEffect(useCallback(() => { fetchEvaluable(); }, [fetchEvaluable]));

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchEvaluable(true);
    }, [fetchEvaluable]);

    // Xử lý khi bấm vào một môn học
    const handlePressCourse = useCallback((course) => {
        console.log("[EvalList] Navigating to form for:", course.courseCode);
        // Chuyển sang màn hình Form đánh giá, truyền các thông tin cần thiết
        navigation.navigate('EvaluationForm', {
            courseId: course.courseId,
            courseCode: course.courseCode,
            courseName: course.courseName,
            semester: course.semester,
            academicYear: course.academicYear,
            // instructorId: course.instructorId, // Truyền nếu có
            // instructorName: course.instructorName // Truyền nếu có
        });
    }, [navigation]);

    const renderEmpty = () => (
        <View style={styles.centeredMessage}>
            <FontAwesome5 name="check-circle" size={50} color="#28a745" style={{marginBottom: 15}}/>
            <Text style={styles.emptyText}>Hiện không có môn học nào cần bạn đánh giá.</Text>
        </View>
    );

    const renderError = () => (
         <View style={styles.centeredMessage}>
             <FontAwesome5 name="exclamation-triangle" size={50} color="#dc3545" style={{marginBottom: 15}} />
             <Text style={styles.errorText}>Không thể tải danh sách môn học</Text>
             <Text style={styles.errorDetails}>{error}</Text>
             <TouchableOpacity style={styles.retryButton} onPress={() => fetchEvaluable()}>
                 <Text style={styles.retryButtonText}>Thử lại</Text>
             </TouchableOpacity>
         </View>
     );


        return (
        <SafeAreaView style={styles.safeArea}>
            {isLoading ? (
                <View style={styles.centeredMessage}><ActivityIndicator size="large" color="#003366" /></View>
            ) : error ? (
                 renderError()
            ) : (
                <FlatList
                    data={evaluatableCourses}
                    renderItem={({ item }) => <CourseItem item={item} onPress={() => handlePressCourse(item)} />}
                    keyExtractor={(item) => `${item.courseId}-${item.semester}-${item.academicYear}`} // Key duy nhất
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#003366"]} tintColor={"#003366"} /> }
                />
            )}
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
    listContainer: { paddingVertical: 10, paddingHorizontal: 15, flexGrow: 1 },
    courseItem: {
        backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center',
        padding: 15, marginBottom: 10, borderRadius: 8,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1, }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
        borderWidth: 1, borderColor: '#eee'
    },
    courseInfo: { flex: 1, marginRight: 10 },
    courseName: { fontSize: 16, fontWeight: 'bold', color: '#003366', marginBottom: 3 },
    courseDetails: { fontSize: 13, color: '#6c757d' },
    instructorName: { fontSize: 13, color: '#888', fontStyle: 'italic', marginTop: 2 },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16, color: '#6c757d', textAlign: 'center' },
    errorText: { fontSize: 17, fontWeight: '600', color: '#dc3545', textAlign: 'center', marginBottom: 5 },
    errorDetails: { fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#007bff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 5 },
    retryButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default EvaluationListScreen;
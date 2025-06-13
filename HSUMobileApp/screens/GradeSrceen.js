// screens/GradesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, ActivityIndicator, Modal, RefreshControl, Alert, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
// Bỏ import Picker nếu không dùng nữa

const API_BASE_URL = 'http://10.101.39.47:5000'; // <-- Kiểm tra IP/URL
const screenWidth = Dimensions.get('window').width;

// --- Component hiển thị ô Tổng quan ---
const StatBox = React.memo(({ gradeLetter, count, color }) => (
    <View style={styles.statBox}>
        <View style={[styles.statIconCircle, { backgroundColor: color }]}>
            <Text style={styles.statIconText}>{gradeLetter}</Text>
        </View>
        <View style={styles.statTextBox}>
            <Text style={styles.statLabel}>SỐ MÔN</Text>
            <Text style={styles.statCount}>{count}</Text>
        </View>
    </View>
));

// --- Component hiển thị một môn học trong danh sách ---
const GradeItem = React.memo(({ item }) => {
    const getDetailedScores = () => {
        const scores = [];
        if (typeof item.midtermScore === 'number') scores.push(item.midtermScore.toFixed(2));
        if (typeof item.assignmentScore === 'number') scores.push(item.assignmentScore.toFixed(2));
        if (typeof item.practicalScore === 'number') scores.push(item.practicalScore.toFixed(2));
        if (typeof item.finalExamScore === 'number') scores.push(item.finalExamScore.toFixed(2));
        return scores.join('; ') || '-';
    };

    return (
        <View style={styles.gradeCard}>
            <Text style={styles.courseNameText} numberOfLines={2}>
                {item.courseName || 'N/A'}
            </Text>
            <View style={[styles.gradeRow, styles.separator]}>
                <Text style={styles.gradeLabel}>Mã môn</Text>
                <Text style={[styles.gradeValue, styles.alignRight]}>{item.courseCode || 'N/A'}</Text>
            </View>
            <View style={[styles.gradeRow, styles.separator]}>
                <Text style={styles.gradeLabel}>Điểm tổng</Text>
                <Text style={[styles.gradeValue, styles.alignRight, styles.overallScoreValue]}>
                    {typeof item.overallScore === 'number' ? item.overallScore.toFixed(1) : '-'}
                </Text>
            </View>
             <View style={styles.gradeRow}>
                 <Text style={styles.gradeLabel}>Chi tiết</Text>
                 <Text style={[styles.gradeValue, styles.alignRight]}>{getDetailedScores()}</Text>
             </View>
        </View>
    );
});

// --- Component Modal Chọn Học Kỳ ---
const ModalSemesterPicker = React.memo(({ label, options = [], selectedValue, onValueChange, placeholder = "Chọn học kỳ..." }) => {
    const [modalVisible, setModalVisible] = useState(false);
    // Tìm label của học kỳ đang được chọn để hiển thị
    const selectedLabel = options.find(option => option === selectedValue) || placeholder;

    const handleSelect = (value) => {
        onValueChange(value); // Gọi hàm cập nhật state ở component cha
        setModalVisible(false); // Đóng modal
    };

    return (
        <View style={styles.pickerRow}>
            <Text style={styles.semesterLabel}>{label}</Text>
            {/* Ô bấm để mở Modal */}
            <TouchableOpacity style={styles.pickerTrigger} onPress={() => setModalVisible(true)}>
                <Text style={selectedValue ? styles.pickerTriggerText : styles.pickerPlaceholder} numberOfLines={1}>
                    {selectedLabel}
                </Text>
                <FontAwesome5 name="chevron-down" size={14} color="#6c757d" style={styles.pickerIcon} />
            </TouchableOpacity>

            {/* Modal Popup */}
            <Modal
                transparent={true}
                visible={modalVisible}
                animationType="fade" // Hiệu ứng xuất hiện
                onRequestClose={() => setModalVisible(false)} // Xử lý khi bấm nút back cứng (Android)
            >
                {/* Lớp phủ mờ */}
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    {/* Nội dung Modal */}
                    <TouchableOpacity style={styles.modalContent} activeOpacity={1} /* Ngăn bấm xuyên qua content */ >
                        <Text style={styles.modalTitle}>Chọn học kỳ</Text>
                        {/* Danh sách các học kỳ */}
                        <FlatList
                            data={options} // Danh sách các label học kỳ
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        // Highlight học kỳ đang được chọn
                                        item === selectedValue && styles.modalItemSelected
                                    ]}
                                    onPress={() => handleSelect(item)} // Chọn học kỳ này
                                >
                                    <Text style={[
                                        styles.modalItemText,
                                        item === selectedValue && styles.modalItemSelectedText
                                    ]}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.modalSeparator} />} // Đường kẻ phân cách
                            style={{ maxHeight: '80%' }} // Giới hạn chiều cao FlatList
                        />
                         {/* Nút Đóng Modal */}
                         <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                             <Text style={styles.modalCloseButtonText}>Đóng</Text>
                         </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
});


// ===========================================
// === COMPONENT CHÍNH: GradesScreen =========
// ===========================================
const GradesScreen = () => {
    const navigation = useNavigation();
    const [allGrades, setAllGrades] = useState([]);
    const [sections, setSections] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [selectedSemesterKey, setSelectedSemesterKey] = useState(null); // Lưu label kỳ đang chọn
    const [overallStats, setOverallStats] = useState({ A: 0, B: 0, C: 0, F: 0, Other: 0 });
    const [semesterGPA, setSemesterGPA] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

     // --- Hàm xử lý dữ liệu sau khi fetch ---
     const processFetchedData = useCallback((data) => {
        if (!Array.isArray(data)) { console.error("[GradesScreen] processFetchedData: Input data is not an array!"); setOverallStats({ A: 0, B: 0, C: 0, F: 0, Other: 0 }); setSemesters([]); return; };
        console.log("[GradesScreen] Processing fetched data...");
        // 1. Tính toán thống kê tổng quan
        const stats = { A: 0, B: 0, C: 0, F: 0, Other: 0 };
        data.forEach(grade => {
             const letter = grade.letterGrade?.toUpperCase(); if (letter === 'A') stats.A++; else if (letter === 'B+' || letter === 'B') stats.B++; else if (letter === 'C+' || letter === 'C') stats.C++; else if (letter === 'F' || grade.status === 'Failed') stats.F++; else if (grade.status !== 'In Progress' && grade.status !== 'Studying') stats.Other++;
         });
         stats.Other += stats.F; // Gộp F vào Other (#)
         setOverallStats(stats);

        // 2. Lấy danh sách học kỳ duy nhất và sắp xếp
        const semesterMap = new Map();
        data.forEach(item => { if(item.semester && item.academicYear){ const key = `${item.academicYear}-${item.semester}`; const label = `${item.semester} (${item.academicYear})`; if (!semesterMap.has(key)) { semesterMap.set(key, { key: key, label: label, year: item.academicYear, semester: item.semester }); } } });
        const sortedSemesters = Array.from(semesterMap.values()).sort((a, b) => { if (b.year !== a.year) return b.year.localeCompare(a.year); const semesterOrder = {'Học kỳ 1': 1, 'Học kỳ Tết': 2, 'Học kỳ 2': 3, 'Học kỳ Hè': 4}; return (semesterOrder[a.semester] || 99) - (semesterOrder[b.semester] || 99); });
        const semesterLabels = sortedSemesters.map(s => s.label);
        setSemesters(semesterLabels);

        // 3. Chọn học kỳ mới nhất làm mặc định nếu chưa có lựa chọn
        if (semesterLabels.length > 0 && !selectedSemesterKey) { setSelectedSemesterKey(semesterLabels[0]); }
        else if (semesters.length === 0) { setSelectedSemesterKey(null); }
    }, [selectedSemesterKey]); // Dependency là selectedSemesterKey

    // --- Hàm fetch điểm ---
    const fetchMyGrades = useCallback(async (isRefreshing = false) => {
        if (!isRefreshing) setIsLoading(true); setError(null); console.log('[GradesScreen] Fetching my grades...'); let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error('Token không tồn tại...');
            const apiUrl = `${API_BASE_URL}/api/grades/my`;
            const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            let result = JSON.parse(await response.text()); console.log(`[GradesScreen] API Status: ${response.status}`);
            if (response.ok && result.success && Array.isArray(result.data)) { setAllGrades(result.data || []); processFetchedData(result.data || []); console.log(`[GradesScreen] Fetched ${result.count ?? 0} grades.`); }
            else { throw new Error(result.message || `Lỗi ${response.status}`); }
        } catch (err) { console.error('[GradesScreen] Error fetching grades:', err); setError(err.message); setAllGrades([]); setSemesters([]); setSections([]); setOverallStats({ A: 0, B: 0, C: 0, F: 0, Other: 0 }); setSemesterGPA(null); if (String(err.message).includes('Token')) { Alert.alert("Phiên hết hạn", "...", [{ text: "OK", onPress: () => navigation.replace('Login') }]); }}
        finally { if (!isRefreshing) setIsLoading(false); setRefreshing(false); }
    }, [navigation, processFetchedData, selectedSemesterKey]); // Dependency là processFetchedData và selectedSemesterKey

    // --- Fetch lần đầu khi mount ---
     useEffect(() => { fetchMyGrades(); }, []); // Chỉ chạy 1 lần

    // --- Nhóm dữ liệu và tính GPA khi học kỳ chọn hoặc dữ liệu gốc thay đổi ---
    useEffect(() => {
        if (!selectedSemesterKey || allGrades.length === 0) { setSections([]); setSemesterGPA(null); return; }
        console.log(`[GradesScreen] Processing data for selected semester: ${selectedSemesterKey}`);
        const gradesForSemester = allGrades.filter(grade => `${grade.semester} (${grade.academicYear})` === selectedSemesterKey);
        setSections([{ title: selectedSemesterKey, data: gradesForSemester }]); // Cập nhật sections

        // Tính GPA hệ 10
        let totalWeightedScore = 0; let totalCredits = 0;
        gradesForSemester.forEach(grade => { if (typeof grade.overallScore === 'number' && typeof grade.credits === 'number' && grade.credits > 0 && grade.status !== 'In Progress' && grade.status !== 'Studying') { totalWeightedScore += grade.overallScore * grade.credits; totalCredits += grade.credits; } });
        const gpa = totalCredits > 0 ? (totalWeightedScore / totalCredits).toFixed(1) : '-';
        setSemesterGPA(gpa); console.log(`[GradesScreen] Semester GPA calculated: ${gpa}`);
    }, [selectedSemesterKey, allGrades]); // Chạy lại khi thay đổi

    // --- Kéo refresh ---
    const onRefresh = useCallback(() => { setRefreshing(true); fetchMyGrades(true); }, [fetchMyGrades]);

    // --- UI Chính ---
    return (
        <SafeAreaView style={styles.safeArea}>
            {isLoading && allGrades.length === 0 ? (
                <View style={styles.centeredMessage}><ActivityIndicator size="large" color="#002366" /><Text style={styles.loadingText}>Đang tải điểm...</Text></View>
             ) : error ? (
                <View style={styles.centeredMessage}><FontAwesome5 name="exclamation-circle" size={40} color="#e63946" /><Text style={styles.errorText}>Không thể tải điểm</Text><Text style={styles.errorDetailText}>{error?.message || error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => fetchMyGrades()}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></View>
             ) : (
                 <SectionList
                     sections={sections} // Dữ liệu đã nhóm
                     keyExtractor={(item, index) => item._id ? item._id.toString() : index.toString()}
                     renderItem={({ item }) => <GradeItem item={item} />}
                     // --- Render Header Section với Modal Picker ---
                     renderSectionHeader={({ section: { title } }) => (
                          <View style={styles.semesterSelectorContainer}>
                              {/* Sử dụng ModalSemesterPicker */}
                              <ModalSemesterPicker
                                   label="Học kỳ"
                                   options={semesters} // Danh sách học kỳ
                                   selectedValue={selectedSemesterKey} // Học kỳ đang chọn
                                   onValueChange={setSelectedSemesterKey} // Hàm cập nhật khi chọn
                              />
                              {/* Hàng GPA */}
                              <View style={styles.gpaRow}>
                                   <Text style={styles.gpaLabel}>Điểm trung bình học kỳ:</Text>
                                   <Text style={styles.gpaValue}>{semesterGPA ?? '-'}</Text>
                              </View>
                          </View>
                     )}
                     // --- // ---
                     ListHeaderComponent={ // Phần Tổng Quan
                         <View style={styles.overallContainer}>
                             <Text style={styles.overallTitle}>Tổng quan</Text>
                             <View style={styles.statsRow}>
                                 <StatBox gradeLetter="A" count={overallStats.A} color="#4caf50" />
                                 <StatBox gradeLetter="B" count={overallStats.B} color="#2196f3" />
                             </View>
                             <View style={styles.statsRow}>
                                 <StatBox gradeLetter="C" count={overallStats.C} color="#ff9800" />
                                 <StatBox gradeLetter="#" count={overallStats.Other} color="#f44336" />
                             </View>
                         </View>
                     }
                     contentContainerStyle={styles.listContainer}
                     showsVerticalScrollIndicator={false}
                     refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]} tintColor={"#002366"} /> }
                     stickySectionHeadersEnabled={true}
                     ListEmptyComponent={ // Khi không có điểm cho kỳ đã chọn
                         !isLoading ? (
                             <View style={styles.centeredMessage}>
                                  <FontAwesome5 name="meh" size={50} color="#ccc" />
                                  <Text style={styles.emptyText}>Không có dữ liệu điểm cho học kỳ này.</Text>
                             </View>
                         ) : null
                     }
                 />
             )}
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#eef2f5' },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 25, marginTop: 50 },
    loadingText: { marginTop: 12, fontSize: 16, color: '#6c757d' },
    errorText: { marginTop: 15, fontSize: 17, fontWeight: '600', color: '#e63946', textAlign: 'center' },
    errorDetailText: { marginTop: 5, fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: '#1d3557', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 8, elevation: 2, shadowOpacity: 0.1 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    emptyText: { marginTop: 15, fontSize: 16, color: '#6c757d', textAlign:'center' },
    listContainer: { paddingHorizontal: 12, paddingBottom: 20, flexGrow: 1 },
     overallContainer: { paddingVertical: 15, paddingHorizontal: 10, marginBottom: 0, backgroundColor:'#eef2f5' },
     overallTitle: { fontSize: 16, fontWeight: 'bold', color: '#34495e', marginBottom: 15, textTransform: 'uppercase', paddingLeft: 5 },
     statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12, },
     statBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, width: (screenWidth / 2) - 28, elevation: 3, shadowColor: "#999", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3 },
     statIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
     statIconText: { color: '#fff', fontSize: 18, fontWeight: 'bold'},
     statTextBox: { flex: 1 },
     statLabel: { fontSize: 12, color: '#555', textTransform:'uppercase', marginBottom: 2 },
     statCount: { fontSize: 22, fontWeight: 'bold', color: '#111' },
      semesterSelectorContainer: { paddingTop: 15, paddingBottom: 10, paddingHorizontal: 15, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginBottom: 15, },
      pickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, }, // Tăng marginBottom
      semesterLabel: { fontSize: 15, fontWeight: '500', color: '#34495e', marginRight: 10, },
       pickerTrigger: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 8, borderWidth: 1, borderColor: '#dfe6e9', paddingVertical: 10, paddingHorizontal: 12, height: 42 },
       pickerTriggerText: { fontSize: 15, color: '#d9534f', fontWeight: 'bold' },
       pickerPlaceholder: { fontSize: 15, color: '#6c757d' },
       pickerIcon: { marginLeft: 5 },
       gpaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 5 },
       gpaLabel: { fontSize: 14, color: '#666' },
       gpaValue: { marginLeft: 5, fontWeight: 'bold', fontSize: 15, color: '#007bff' },
       modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
       modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 15, width: '85%', maxHeight: '70%', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
       modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#003366' },
       modalItem: { paddingVertical: 14, paddingHorizontal: 10 }, // Tăng padding dọc
       modalItemSelected: { backgroundColor: '#e7f0ff', borderRadius: 5 },
       modalItemText: { fontSize: 16, color: '#333' },
       modalItemSelectedText: { fontWeight: 'bold', color: '#0056b3' },
       modalSeparator: { height: 1, backgroundColor: '#eee' },
       modalCloseButton: { marginTop: 15, paddingVertical: 10, alignItems: 'center' },
       modalCloseButtonText: { fontSize: 16, color: '#007bff', fontWeight: '500' },
      gradeCard: { backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 10, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 15, elevation: 1.5, shadowColor: "#ddd", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, borderWidth: 1, borderColor: '#f0f0f0' },
      courseNameText: { fontSize: 15, fontWeight: 'bold', color: '#c62828', marginBottom: 12 },
      gradeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, alignItems: 'center', },
      separator: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
      gradeLabel: { fontSize: 14, color: '#555', fontWeight: '500', width: '35%' },
      gradeValue: { fontSize: 14, color: '#333', fontWeight: '500', textAlign: 'right', flexShrink: 1 },
      alignRight: { textAlign: 'right' },
      overallScoreValue: { fontWeight: 'bold', color: '#0056b3', fontSize: 15 },
});

export default GradesScreen;
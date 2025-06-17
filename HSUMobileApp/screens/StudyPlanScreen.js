// screens/StudyPlanScreen.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, SectionList, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, RefreshControl, Modal, Platform // <<< Đã IMPORT Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; // <<< IMPORT PICKER ĐÚNG
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// import axios from 'axios'; // Bỏ nếu dùng fetch

// <<< ĐỊNH NGHĨA BASE_URL TRỰC TIẾP >>>
const BASE_URL = API_BASE_URL;// <<< THAY ĐỊA CHỈ IP VÀ PORT ĐÚNG >>>

// --- Component hiển thị một môn trong kế hoạch ---
const PlannedCourseItem = React.memo(({ item, onRemove, onMove }) => (
    <View style={styles.plannedItem}>
        <View style={styles.plannedCourseInfo}>
            {/* Sử dụng optional chaining (?.) để tránh lỗi nếu courseId null/undefined */}
            <Text style={styles.plannedCourseName} numberOfLines={2}>{item.courseId?.courseName || 'Lỗi Tên Môn'}</Text>
            <Text style={styles.plannedCourseCode}>{item.courseId?.courseCode || 'N/A'} - {item.courseId?.credits ?? '?'} TC</Text>
        </View>
        <View style={styles.plannedItemActions}>
             <TouchableOpacity onPress={() => onMove(item)} style={styles.actionButton} accessibilityLabel="Chuyển môn">
                 <FontAwesome5 name="exchange-alt" size={16} color="#007bff" />
             </TouchableOpacity>
             <TouchableOpacity onPress={() => onRemove(item)} style={styles.actionButton} accessibilityLabel="Xóa môn">
                <FontAwesome5 name="trash-alt" size={16} color="#dc3545" />
             </TouchableOpacity>
        </View>
    </View>
));

// --- Component Modal chọn kỳ để chuyển môn ---
const MoveCourseModal = React.memo(({ visible, currentSemesterCode, allSemesterCodes, onClose, onConfirmMove }) => {
    const [targetSemester, setTargetSemester] = useState(null); // Bắt đầu là null

    // Hàm format mã kỳ thành tên đẹp
    const formatSemesterCodeToLabel = (code) => {
        if (!code || code === 'unsorted') return "Chưa sắp xếp";
        try {
            const yearPart = code.substring(0, 2);
            const semPart = code.substring(2);
            let semName = `Kỳ ${code}`; // Default
            let startYear = parseInt(`20${yearPart}`, 10);
            let academicYear = `${startYear}-${startYear + 1}`;
            if (semPart === '1') { semName = 'Học kỳ 1'; academicYear = `${startYear}-${startYear + 1}`; }
            else if (semPart === '4') { 
                semName = 'Học kỳ Tết';
                academicYear = `${startYear}-${startYear + 1}`; 
            }
             else if (semPart === '2') { semName = 'Học kỳ 2'; academicYear = `${startYear}-${startYear + 1}`; } // Sửa lại năm học nếu cần
             else if (semPart === '3') { semName = 'Học kỳ hè'; academicYear = `${startYear}-${startYear + 1}`; } // Sửa lại năm học nếu cần

            return `${semName} (${academicYear})`;
        } catch (e) { console.error("Error formatting code:", code, e); return `Kỳ ${code}`; }
    };

    // Tạo options cho picker
    const semesterOptions = useMemo(() => [
        { label: "Chưa sắp xếp", value: 'unsorted' },
        ...allSemesterCodes
              .filter(code => code && code !== 'unsorted' && code !== currentSemesterCode)
              .map(code => ({ label: formatSemesterCodeToLabel(code), value: code }))
    ], [allSemesterCodes, currentSemesterCode]);

    useEffect(() => { if (visible) setTargetSemester(null); }, [visible]);

    return (
        <Modal transparent={true} visible={visible} animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                 <View style={styles.moveModalContent} onStartShouldSetResponder={() => true}>
                    <Text style={styles.moveModalTitle}>Chuyển môn học đến</Text>
                     <View style={styles.pickerContainerStyle}>
                         {/* <<< SỬ DỤNG PICKER ĐÚNG VÀ STYLE ĐÚNG >>> */}
                         <Picker
                            selectedValue={targetSemester}
                            onValueChange={(itemValue) => setTargetSemester(itemValue)}
                            style={styles.nativePickerStyle} 
                            itemStyle={styles.pickerItemTextIOS} 
                            mode="dropdown">
                            <Picker.Item label="-- Chọn kỳ mới --" value={null} style={styles.pickerPlaceholderItem}/>
                            {semesterOptions.map(opt => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
                        </Picker>
                    </View>
                    <View style={styles.moveModalButtons}>
                         <TouchableOpacity style={styles.modalButton} onPress={onClose}>
                             <Text style={styles.modalButtonText}>Hủy</Text>
                         </TouchableOpacity>
                         <TouchableOpacity style={[styles.modalButton, styles.confirmButton, !targetSemester && styles.confirmButtonDisabled]} onPress={() => targetSemester && onConfirmMove(targetSemester)} disabled={!targetSemester}>
                             <Text style={[styles.modalButtonText, styles.confirmButtonText]}>Xác nhận</Text>
                         </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
});


// === COMPONENT CHÍNH: StudyPlanScreen =====
const StudyPlanScreen = () => {
    const navigation = useNavigation();
    const [studyPlan, setStudyPlan] = useState({ plannedSemesters: [], unsortedCourses: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
    const [movingCourseInfo, setMovingCourseInfo] = useState(null);
    const isMountedRef = useRef(true);

    // --- Fetch Kế hoạch học tập ---
    const fetchStudyPlan = useCallback(async (isRefreshing = false) => {
        if (!isMountedRef.current) return; if (!isRefreshing) setIsLoading(true); setError(null); console.log("[StudyPlan] Fetching plan..."); let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Token required.");
            const response = await fetch(`${BASE_URL}/api/study-plan/my`, { headers: { Authorization: `Bearer ${token}` } });
            if (!isMountedRef.current) return; const resText = await response.text(); let result; try {result = JSON.parse(resText);} catch(e){throw new Error(`JSON parse error: ${resText}`)} console.log(`[StudyPlan] Fetch Status: ${response.status}, Success: ${result?.success}`);
            if (response.ok && result.success && result.data) { const planData = result.data; if (planData.plannedSemesters?.length > 1) planData.plannedSemesters.sort((a, b) => (a.semesterCode || '').localeCompare(b.semesterCode || '')); if (isMountedRef.current) { setStudyPlan(planData); setIsDirty(false); } }
            else { throw new Error(result.message || "Failed load plan."); }
        } catch (err) { console.error("[StudyPlan] Fetch Error:", err); if (isMountedRef.current) setError(err.message || "Lỗi tải kế hoạch."); }
        finally { if (isMountedRef.current) { if (!isRefreshing) setIsLoading(false); setRefreshing(false); } }
    }, [navigation]);

    // --- Fetch khi focus ---
    useFocusEffect(useCallback(() => { isMountedRef.current = true; fetchStudyPlan(); return () => { isMountedRef.current = false; }; }, [fetchStudyPlan]));
    // --- Refresh ---
    const handleRefresh = useCallback(() => { setRefreshing(true); fetchStudyPlan(true); }, [fetchStudyPlan]);
    // --- Xóa môn ---
    const handleRemoveCourse = useCallback((courseToRemove) => {
        if (!courseToRemove?.courseId?._id && !courseToRemove?.courseId) { console.error("Cannot remove course, missing ID:", courseToRemove); return; }
        const courseIdToRemove = courseToRemove.courseId?._id ?? courseToRemove.courseId; const courseNameToRemove = courseToRemove.courseId?.courseName ?? "môn học này";
        Alert.alert("Xác nhận xóa", `Xóa môn "${courseNameToRemove}" khỏi kế hoạch?`, [ { text: "Hủy", style: "cancel" }, { text: "Xóa", style: "destructive", onPress: () => { setStudyPlan(prev => ({ plannedSemesters: prev.plannedSemesters.map(s => ({ ...s, courses: s.courses.filter(c => (c.courseId?._id ?? c.courseId) !== courseIdToRemove) })), unsortedCourses: prev.unsortedCourses.filter(c => (c.courseId?._id ?? c.courseId) !== courseIdToRemove) })); setIsDirty(true); } } ]);
   }, []);
    // --- Mở Modal Chuyển môn ---
    const handleOpenMoveModal = useCallback((course, fromSection) => { setMovingCourseInfo({ course, fromSection }); setIsMoveModalVisible(true); }, []);
     // --- Xác nhận Chuyển môn ---
     const handleConfirmMove = useCallback((targetSemesterCode) => {
        if (!movingCourseInfo || targetSemesterCode === null) { setIsMoveModalVisible(false); return; }
        const { course, fromSection } = movingCourseInfo;
        const courseIdToMove = course.courseId?._id ?? course.courseId;
        const courseDataToMove = { courseId: courseIdToMove };
        if (!courseIdToMove) { console.error("[StudyPlan] Move Error: Invalid courseId."); setIsMoveModalVisible(false); setMovingCourseInfo(null); return; }
        setStudyPlan(prevPlan => {
            let newPlannedSemesters = prevPlan.plannedSemesters.map(sem => ({ ...sem, courses: sem.courses.filter(c => (c.courseId?._id ?? c.courseId) !== courseIdToMove) }));
            let newUnsortedCourses = prevPlan.unsortedCourses.filter(c => (c.courseId?._id ?? c.courseId) !== courseIdToMove);
            if (targetSemesterCode === 'unsorted') {
                if (!newUnsortedCourses.some(c => (c.courseId?._id ?? c.courseId) === courseIdToMove)) newUnsortedCourses.push(courseDataToMove);
            } else {
                let found = false;
                newPlannedSemesters = newPlannedSemesters.map(sem => {
                    if (sem.semesterCode === targetSemesterCode) {
                        found = true;
                        if (!sem.courses.some(c => (c.courseId?._id ?? c.courseId) === courseIdToMove))
                            return { ...sem, courses: [...sem.courses, courseDataToMove] };
                    }
                    return sem;
                });
                if (!found) {
                    // Nếu chưa có học kỳ này, tạo mới object học kỳ
                    // Suy luận tên kỳ và năm học từ mã kỳ
                    let semName = 'Kỳ';
                    let year = 2024;
                    if (targetSemesterCode.length >= 3) {
                        const yearPart = targetSemesterCode.substring(0,2);
                        const semPart = targetSemesterCode.substring(2);
                        year = 2000 + parseInt(yearPart, 10);
                        if (semPart === '1') semName = 'Học kỳ 1';
                        else if (semPart === '2') semName = 'Học kỳ 2';
                        else if (semPart === '3') semName = 'Học kỳ Hè';
                        else if (semPart === '4') semName = 'Học kỳ Tết';
                    }
                    newPlannedSemesters.push({
                        semesterCode: targetSemesterCode,
                        semesterName: semName,
                        academicYear: `${year}-${year+1}`,
                        courses: [courseDataToMove]
                    });
                }
            }
            newPlannedSemesters.sort((a, b) => (a.semesterCode || '').localeCompare(b.semesterCode || ''));
            return { plannedSemesters: newPlannedSemesters, unsortedCourses: newUnsortedCourses };
        });
        setIsMoveModalVisible(false); setMovingCourseInfo(null); setIsDirty(true);
    }, [movingCourseInfo]);
    // --- Lưu Kế hoạch ---
    const handleSaveChanges = async () => {
         if (!isDirty) { Alert.alert("Thông báo", "Không có thay đổi để lưu."); return; }
         console.log("[StudyPlan] Saving changes..."); setIsSaving(true); setError(null); let token;
         try {
             token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Token required.");
              const planToSend = { plannedSemesters: studyPlan.plannedSemesters.map(sem => ({ semesterCode: sem.semesterCode, semesterName: sem.semesterName, academicYear: sem.academicYear, courses: sem.courses.map(c => ({ courseId: c.courseId?._id ?? c.courseId })) })), unsortedCourses: studyPlan.unsortedCourses.map(c => ({ courseId: c.courseId?._id ?? c.courseId })) };
             console.log("[StudyPlan] Sending plan:", JSON.stringify(planToSend, null, 2));
             const response = await fetch(`${BASE_URL}/api/study-plan/my`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(planToSend) });
             if (!isMountedRef.current) return; const resText = await response.text(); let result; try{ result = JSON.parse(resText); } catch(e){throw new Error(`JSON parse error: ${resText}`)} console.log(`[StudyPlan] Save Status: ${response.status}, Success: ${result?.success}`);
             if (response.ok && result.success) { Alert.alert("Thành công", result.message || "Đã lưu kế hoạch."); setIsDirty(false); fetchStudyPlan(); /* Fetch lại để cập nhật populate */}
             else { throw new Error(result.message || "Lưu thất bại."); }
         } catch (err) { console.error("[StudyPlan] Save Error:", err); if(isMountedRef.current) setError(err.message || "Lỗi lưu kế hoạch."); Alert.alert("Lỗi", err.message || "Không thể lưu."); }
         finally { if(isMountedRef.current) setIsSaving(false); }
     };

    // --- Chuẩn bị sections cho SectionList ---
    const sections = useMemo(() => {
        const plannedData = (studyPlan.plannedSemesters || []) .filter(sem => sem?.semesterCode).map(sem => ({ title: `${sem.semesterName || 'Kỳ'} ${sem.semesterCode || '?'} (${sem.academicYear || 'N/A'})`, data: (sem.courses || []).filter(c => c?.courseId), sectionId: sem.semesterCode }));
        const unsortedData = (studyPlan.unsortedCourses || []).filter(c => c?.courseId).length > 0 ? [{ title: "Chưa sắp xếp", data: studyPlan.unsortedCourses.filter(c => c?.courseId), sectionId: 'unsorted' }] : [];
        return [...plannedData, ...unsortedData];
    }, [studyPlan]);
    // --- Lấy danh sách mã kỳ cho Modal ---
    const allSemesterCodes = useMemo(() => {
        // Lấy tất cả mã kỳ từ kế hoạch hiện tại
        const codes = (studyPlan.plannedSemesters || []).map(s => s.semesterCode).filter(Boolean);
        // Thêm các mã kỳ phụ nếu chưa có
        const extraCodes = ['unsorted'];
        // Tìm năm học gần nhất (nếu có)
        let latestYearPrefix = '24'; // Mặc định năm gần nhất
        if (codes.length > 0) {
            // Lấy năm lớn nhất trong các mã kỳ
            const yearCodes = codes.map(c => c?.substring(0,2)).filter(Boolean);
            if (yearCodes.length > 0) {
                latestYearPrefix = yearCodes.sort().reverse()[0];
            }
        }
        // Mã học kỳ Tết và Hè theo chuẩn mã kỳ (ví dụ: 241, 242, 243, 244)
        const tetCode = latestYearPrefix + '4';
        const heCode = latestYearPrefix + '3';
        // Nếu chưa có thì thêm vào
        if (!codes.includes(tetCode)) codes.push(tetCode);
        if (!codes.includes(heCode)) codes.push(heCode);
        return [...extraCodes, ...codes];
    }, [studyPlan.plannedSemesters]);

    // --- Render ---
    if (isLoading) return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><ActivityIndicator size="large" color="#003366" /></View></SafeAreaView>;
    if (error && !isLoading) return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => fetchStudyPlan()} style={styles.retryButton}><Text style={styles.retryButtonText}>Thử lại</Text></TouchableOpacity></View></SafeAreaView>;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Kế hoạch học tập</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AddCourseToPlan')} style={styles.addButton} accessibilityLabel="Thêm môn học">
                     <FontAwesome5 name="plus" size={18} color="#007bff" />
                 </TouchableOpacity>
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item, index) => item.courseId?._id?.toString() ?? item.courseId?.toString() ?? `item-${section.sectionId}-${index}`}
                renderItem={({ item, section }) => ( <PlannedCourseItem item={item} onRemove={() => handleRemoveCourse(item)} onMove={() => handleOpenMoveModal(item, section.sectionId)} /> )}
                renderSectionHeader={({ section: { title } }) => ( <Text style={styles.sectionHeader}>{title}</Text> )}
                ListEmptyComponent={ <View style={styles.centeredMessage}><Text style={styles.emptyText}>Kế hoạch trống. Nhấn + để thêm.</Text></View> }
                contentContainerStyle={styles.listContainer}
                stickySectionHeadersEnabled={false}
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#003366"]} tintColor={"#003366"} /> }
                extraData={studyPlan}
            />

            {isDirty && (
                 <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSaveChanges} disabled={isSaving}>
                     {isSaving ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.saveButtonText}>Lưu thay đổi</Text>}
                 </TouchableOpacity>
             )}

             <MoveCourseModal visible={isMoveModalVisible} currentSemesterCode={movingCourseInfo?.fromSection} allSemesterCodes={allSemesterCodes} onClose={() => setIsMoveModalVisible(false)} onConfirmMove={handleConfirmMove} />
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    header: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: '#fff' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
    addButton: { position: 'absolute', right: 15, padding: 5 },
    listContainer: { paddingHorizontal: 15, paddingBottom: 80 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#495057', backgroundColor: '#e9ecef', paddingVertical: 8, paddingHorizontal: 10, marginTop: 15, marginBottom: 5, borderRadius: 5 },
    plannedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    plannedCourseInfo: { flex: 1, marginRight: 10 },
    plannedCourseName: { fontSize: 15, fontWeight: '500', color: '#212529', marginBottom: 2 },
    plannedCourseCode: { fontSize: 13, color: '#6c757d' },
    plannedItemActions: { flexDirection: 'row' },
    actionButton: { paddingHorizontal: 8, paddingVertical: 5, marginLeft: 5 },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 50 },
    emptyText: { fontSize: 16, color: '#6c757d', textAlign: 'center' },
    errorText: { fontSize: 16, color: 'red', textAlign: 'center' },
    retryButton: { backgroundColor: '#007bff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 5, marginTop: 15 },
    retryButtonText: { color: '#fff', fontWeight: 'bold' },
    saveButton: { backgroundColor: '#28a745', paddingVertical: 14, marginHorizontal: 15, marginBottom: 10, borderRadius: 8, alignItems: 'center' },
    saveButtonDisabled: { backgroundColor: '#6c757d' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    moveModalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '85%', alignItems: 'center', maxHeight: '70%' },
    moveModalTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 20 },
    pickerContainerStyle: {
        height: Platform.OS === 'ios' ? 216 : 60,
        width: '100%',
        justifyContent: 'center',
        borderWidth: Platform.OS === 'android' ? 1 : 0,
        borderColor: Platform.OS === 'android' ? '#ccc' : 'transparent',
        borderRadius: Platform.OS === 'android' ? 5 : 0,
        marginBottom: 20,
        overflow: 'hidden',
        backgroundColor: Platform.OS === 'ios' ? '#f0f0f0' : '#fff'
    },
    nativePickerStyle: { // Style cho component Picker
        width: '100%',
        height: Platform.OS === 'ios' ? 216 : 60,
        color: '#000000', // <<< MÀU ĐEN CHO ANDROID
    },
    pickerPlaceholderItem:{ color: '#adb5bd'},
    pickerItemTextIOS:{ // Style cho từng Item trên iOS
        color: '#000000', // <<< MÀU ĐEN CHO IOS
        fontSize: 18,
        // height: 180, // Bỏ height ở đây nếu không cần thiết
        textAlign: 'center'
    },
    moveModalButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, width: '100%' },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5, borderWidth: 1, borderColor: '#ccc', minWidth: 100, alignItems: 'center' },
    modalButtonText: { fontSize: 16 },
    confirmButton: { backgroundColor: '#007bff', borderColor: '#007bff' },
    confirmButtonDisabled: { backgroundColor: '#a0cfff', borderColor: '#a0cfff' },
    confirmButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default StudyPlanScreen;
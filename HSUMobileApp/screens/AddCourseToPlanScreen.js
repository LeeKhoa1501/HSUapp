// screens/AddCourseToPlanScreen.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Keyboard, Platform } from 'react-native'; // Thêm Platform
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
// import { CheckBox } from '@rneui/themed'; // <<< KHÔNG DÙNG >>>

// <<< ĐỊNH NGHĨA BASE_URL TRỰC TIẾP >>>
const BASE_URL = 'http://10.101.39.47:5000'; // <<< THAY IP ĐÚNG >>>

// --- Component Custom Checkbox ---
const CustomCheckbox = ({ isChecked, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.checkboxBase, isChecked && styles.checkboxChecked]} accessibilityLabel={isChecked ? "Đã chọn" : "Chưa chọn"}>
        {isChecked && ( <FontAwesome5 name="check" size={14} color="#fff" /> )}
    </TouchableOpacity>
);

const AddCourseToPlanScreen = ({ navigation }) => {
    const [availableCourses, setAvailableCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCourses, setSelectedCourses] = useState(new Set());
    const [isAdding, setIsAdding] = useState(false);
    const isMountedRef = useRef(true);

    // --- Fetch danh sách môn có thể thêm ---
    useEffect(() => {
        isMountedRef.current = true;
        const fetchAvailable = async () => {
             if (!isMountedRef.current) return; setIsLoading(true); setError(null); let token;
             try {
                 token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Token required.");
                 const response = await fetch(`${BASE_URL}/api/study-plan/available-courses`, { headers: { Authorization: `Bearer ${token}` } });
                 if (!isMountedRef.current) return; const resText = await response.text(); let result; try{ result = JSON.parse(resText); } catch(e){ throw new Error(`JSON parse error: ${resText}`); }
                 console.log(`[AddCourse] API Status: ${response.status}, Success: ${result?.success}`);
                 if (response.ok && result.success && Array.isArray(result.data)) { if(isMountedRef.current) setAvailableCourses(result.data); }
                 else { throw new Error(result.message || "Failed load courses."); }
             } catch (err) { console.error("[AddCourse] Fetch Error:", err); if(isMountedRef.current) setError(err.message || "Lỗi tải môn học."); }
             finally { if(isMountedRef.current) setIsLoading(false); }
         };
        fetchAvailable();
        return () => { isMountedRef.current = false; };
    }, []);

    // --- Lọc danh sách môn ---
    const filteredCourses = useMemo(() => { if (!searchTerm) return availableCourses; const lower = searchTerm.toLowerCase(); return availableCourses.filter(c => c.courseName?.toLowerCase().includes(lower) || c.courseCode?.toLowerCase().includes(lower) ); }, [availableCourses, searchTerm]);

    // --- Chọn/bỏ chọn môn ---
    const toggleCourseSelection = useCallback((courseId) => { setSelectedCourses(prev => { const next = new Set(prev); if (next.has(courseId)) next.delete(courseId); else next.add(courseId); return next; }); }, []);

    // --- Xử lý Thêm vào kế hoạch ---
    const handleAddCourses = async () => {
        if (selectedCourses.size === 0) { return Alert.alert("Chưa chọn môn", "Vui lòng chọn ít nhất một môn học."); }
        setIsAdding(true); setError(null); console.log("[AddCourse] Adding:", [...selectedCourses]); let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Token required.");
            // 1. Lấy kế hoạch hiện tại
            const planRes = await fetch(`${BASE_URL}/api/study-plan/my`, { headers: { Authorization: `Bearer ${token}` } });
            if (!planRes.ok) throw new Error("Cannot get current plan."); const planResult = await planRes.json();
            if (!planResult.success) throw new Error(planResult.message || "Error getting plan.");
            const currentPlan = planResult.data || { plannedSemesters: [], unsortedCourses: [] };
            // 2. Tạo object course mới cần thêm
            const coursesToAdd = [...selectedCourses].map(id => ({ courseId: id }));
            // 3. Tạo kế hoạch mới (thêm vào unsorted, không trùng)
            const existingUnsortedIds = new Set((currentPlan.unsortedCourses || []).map(c => c.courseId?.toString())); const newUnsorted = [...(currentPlan.unsortedCourses || [])]; coursesToAdd.forEach(newC => { if (!existingUnsortedIds.has(newC.courseId?.toString())) newUnsorted.push(newC); });
            const updatedPlan = { plannedSemesters: (currentPlan.plannedSemesters || []).map(s => ({...s, courses: (s.courses || []).map(c=>({courseId: c.courseId?._id ?? c.courseId})) })), unsortedCourses: newUnsorted.map(c=>({courseId: c.courseId})) };
            console.log("[AddCourse] Submitting updated plan:", JSON.stringify(updatedPlan, null, 2));
            // 4. Gửi lên API PUT
            const updateRes = await fetch(`${BASE_URL}/api/study-plan/my`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(updatedPlan) });
            if (!isMountedRef.current) return; const updateText = await updateRes.text(); let updateResult; try{ updateResult = JSON.parse(updateText); } catch(e){ throw new Error(`JSON parse error update: ${updateText}`); }
            if (updateRes.ok && updateResult.success) { Alert.alert("Thành công", `Đã thêm ${selectedCourses.size} môn.`); navigation.goBack(); }
            else { throw new Error(updateResult.message || "Lỗi cập nhật kế hoạch."); }
        } catch (err) { console.error("[AddCourse] Add Error:", err); setError(err.message || "Lỗi thêm môn."); Alert.alert("Lỗi", err.message || "Không thể thêm."); }
        finally { if (isMountedRef.current) setIsAdding(false); }
    };

    // --- Render Course Item ---
    const renderCourseItem = ({ item }) => {
        const isSelected = selectedCourses.has(item._id);
        return (
            <TouchableOpacity style={styles.itemContainer} onPress={() => toggleCourseSelection(item._id)}>
                 <CustomCheckbox isChecked={isSelected} onPress={() => toggleCourseSelection(item._id)} />
                 <View style={styles.itemInfo}>
                     <Text style={styles.itemName} numberOfLines={2}>{item.courseName || 'N/A'}</Text>
                     <Text style={styles.itemDetails}>{item.courseCode || 'N/A'} - {item.credits ?? '?'} TC</Text>
                 </View>
            </TouchableOpacity>
        );
    };

    // --- Render UI Chính ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.searchContainer}>
                 <FontAwesome5 name="search" size={18} color="#6c757d" style={styles.searchIcon} />
                 <TextInput style={styles.searchInput} placeholder="Tìm môn học (tên hoặc mã)..." value={searchTerm} onChangeText={setSearchTerm} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} clearButtonMode="while-editing" />
                 {searchTerm ? <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}><FontAwesome5 name="times-circle" size={18} color="#adb5bd" /></TouchableOpacity> : null}
             </View>

            {isLoading ? <ActivityIndicator style={{marginTop: 30}} size="large" color="#003366"/>
             : error ? <View style={styles.centeredMessage}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={fetchAvailable}><Text>Thử lại</Text></TouchableOpacity></View> // Thêm nút thử lại
             : <FlatList data={filteredCourses} renderItem={renderCourseItem} keyExtractor={(item) => item._id.toString()} contentContainerStyle={styles.listContent} ListEmptyComponent={<View style={styles.centeredMessage}><Text style={styles.emptyText}>Không tìm thấy môn học.</Text></View>} keyboardShouldPersistTaps="handled" />
            }

             <TouchableOpacity style={[styles.addButtonFooter, (isAdding || selectedCourses.size === 0) && styles.addButtonDisabled]} onPress={handleAddCourses} disabled={isAdding || selectedCourses.size === 0}>
                  {isAdding ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.addButtonText}>Thêm {selectedCourses.size > 0 ? `(${selectedCourses.size})` : ''} môn đã chọn</Text>}
             </TouchableOpacity>

        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#f8f9fa' },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, borderWidth: 1, borderColor: '#dee2e6'},
    clearButton: { paddingLeft: 10 },
    listContent: { paddingHorizontal: 0, paddingBottom: 80 },
    itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    checkboxBase: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#adb5bd', borderRadius: 4, backgroundColor: '#fff', marginRight: 15 }, // Tăng marginRight
    checkboxChecked: { backgroundColor: '#007bff', borderColor: '#0056b3', },
    itemInfo: {flex: 1},
    itemName: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 2 },
    itemDetails: { fontSize: 13, color: '#777' },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#888', fontSize: 16 },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 10 }, // Thêm margin dưới cho error text
    retryButton: { marginTop: 10, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#007bff', borderRadius: 5 }, // Style nút thử lại
    retryButtonText: { color: '#fff' }, // Style chữ nút thử lại
    addButtonFooter: { backgroundColor: '#007bff', paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#eee', height: 60 }, // Chiều cao cố định
    addButtonDisabled: { backgroundColor: '#6c757d' },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    // Styles cho ModalPicker (lấy từ StudyPlanScreen nếu cần dùng lại)
});

export default AddCourseToPlanScreen;
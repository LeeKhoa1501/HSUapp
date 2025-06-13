// HSUMobileApp/screens/AcademicRequestFormScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    Platform, Alert, ActivityIndicator, Modal, KeyboardAvoidingView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import { useNavigation } from '@react-navigation/native';
import { ACADEMIC_REQUEST_TYPES } from '../assets/data/requestTypes.js';

const BASE_URL = API_BASE_URL;

// --- UI SUB-COMPONENTS ---

// Component Input có nhãn
const LabeledInput = React.memo(({ label, value, onChangeText, placeholder, keyboardType = 'default', editable = true, multiline = false, numberOfLines = 1, required = false }) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}{required && <Text style={styles.requiredStar}> *</Text>}</Text>
        <TextInput
            style={[styles.input, !editable && styles.disabledInput, multiline && styles.multilineInput]}
            value={String(value || '')} // Đảm bảo value luôn là string
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#ccc"
            keyboardType={keyboardType}
            editable={editable}
            multiline={multiline}
            numberOfLines={numberOfLines}
            textAlignVertical={multiline ? 'top' : 'center'}
        />
    </View>
));

// Component Picker tùy chỉnh sử dụng Modal
const ModalPicker = React.memo(({ label, options = [], selectedValue, onValueChange, placeholder = "Vui lòng chọn...", isLoading = false, required = false }) => {
    const [modalVisible, setModalVisible] = useState(false);
    // Sử dụng selectedValue trực tiếp cho tempValue khi mở modal để tránh lỗi logic khi selectedValue thay đổi từ prop
    const [tempValue, setTempValue] = useState(selectedValue);

    const validOptions = Array.isArray(options)
        ? options.filter(o => o != null && o.value !== undefined && o.value !== null && o.label !== undefined && o.label !== null)
        : [];

    const selectedOption = validOptions.find(option => option.value === selectedValue);
    const displayLabel = selectedOption?.label ? String(selectedOption.label) : placeholder;

    const handleOpen = () => {
        if (!isLoading) {
            setTempValue(selectedValue); // Cập nhật tempValue với giá trị hiện tại trước khi mở
            setModalVisible(true);
        }
    };
    const handleDone = () => {
        onValueChange(tempValue);
        setModalVisible(false);
    };
    const handleCancel = () => {
        setModalVisible(false);
        // Không cần setTempValue(selectedValue) ở đây nữa vì đã làm khi mở modal
    };

    // Cập nhật tempValue nếu selectedValue từ prop thay đổi khi modal không hiển thị
    useEffect(() => {
        if (!modalVisible) {
            setTempValue(selectedValue);
        }
    }, [selectedValue, modalVisible]);

    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}{required && <Text style={styles.requiredStar}> *</Text>}</Text>
            <TouchableOpacity style={styles.pickerTrigger} onPress={handleOpen} disabled={isLoading}>
                {isLoading
                    ? <ActivityIndicator size="small" color="#002366" />
                    : <Text style={(selectedValue !== null && selectedValue !== '') ? styles.pickerTriggerText : styles.pickerPlaceholder} numberOfLines={1}>{displayLabel}</Text>
                }
                {!isLoading && <FontAwesome5 name="chevron-down" size={16} color="#888" style={styles.pickerIcon} />}
            </TouchableOpacity>
            <Modal transparent={true} visible={modalVisible} animationType="fade" onRequestClose={handleCancel}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleCancel}>
                    <TouchableOpacity style={styles.modalContentContainer} activeOpacity={1}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={handleCancel} style={styles.modalHeaderButton}><Text style={styles.modalButtonTextAction}>Hủy</Text></TouchableOpacity>
                            <Text style={styles.modalTitle}>{String(label || 'Chọn mục')}</Text>
                            <TouchableOpacity onPress={handleDone} style={styles.modalHeaderButton}><Text style={[styles.modalButtonTextAction, styles.modalButtonDone]}>Chọn</Text></TouchableOpacity>
                        </View>
                        {validOptions.length > 0 ? (
                            <Picker
                                selectedValue={tempValue}
                                onValueChange={(itemValue) => setTempValue(itemValue)}
                                style={styles.modalPicker}
                                itemStyle={styles.pickerItemTextIOS} // Chỉ có tác dụng trên iOS
                            >
                                <Picker.Item label={String(placeholder)} value={null} style={styles.pickerPlaceholderItemIOS} />
                                {validOptions.map((option, index) => (
                                    <Picker.Item key={String(option.value ?? `opt-${index}-${Math.random()}`)} label={String(option.label || 'Lựa chọn')} value={option.value} />
                                ))}
                            </Picker>
                        ) : (
                            <View style={styles.noOptionsContainer}>
                                <Text style={styles.noOptionsText}>{isLoading ? 'Đang tải...' : 'Không có lựa chọn.'}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
});

// --- MAIN COMPONENT: AcademicRequestFormScreen ---
const AcademicRequestFormScreen = () => {
    const navigation = useNavigation();
    const isMountedRef = useRef(true); // Để kiểm tra component còn mounted không

    // --- State cho Form ---
    const [requestType, setRequestType] = useState(null); // Loại yêu cầu
    const [requestTitle, setRequestTitle] = useState('');   // Tiêu đề/Tên yêu cầu
    const [studentNotes, setStudentNotes] = useState(''); // Nội dung chi tiết yêu cầu
    const [quantity, setQuantity] = useState('1');        // Số lượng (mặc định là 1)
    // const [amountDisplay] = useState('Miễn phí');      // Thành tiền (chỉ hiển thị, có thể bỏ nếu không cần)

    // --- State cho dữ liệu Picker ---
    const [locationsOptions, setLocationsOptions] = useState([]);
    const [selectedReceivingCampusId, setSelectedReceivingCampusId] = useState(null); // Nơi nhận kết quả

    // --- State cho trạng thái tải và gửi ---
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true); // Đổi tên cho rõ ràng
    const [initialDataError, setInitialDataError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Options cho Picker Loại yêu cầu ---
    const requestTypeOptions = ACADEMIC_REQUEST_TYPES; // Lấy từ file data

    // --- Effect để tự động điền Tiêu đề khi Loại yêu cầu thay đổi ---
    useEffect(() => {
        if (requestType) {
            const selectedTypeObj = ACADEMIC_REQUEST_TYPES.find(t => t.value === requestType);
            // Nếu loại yêu cầu không phải là 'OTHER_REQUEST' và có label, tự điền tiêu đề
            if (selectedTypeObj && requestType !== 'OTHER_REQUEST' && selectedTypeObj.label) {
                setRequestTitle(selectedTypeObj.label);
            } else if (requestType === 'OTHER_REQUEST') {
                setRequestTitle(''); // Xóa tiêu đề để người dùng tự nhập
            }
        } else {
            setRequestTitle(''); // Reset tiêu đề nếu không có loại yêu cầu nào được chọn
        }
    }, [requestType]); // Phụ thuộc vào requestType

    // --- Effect để quản lý việc component còn mounted hay không ---
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false; // Set thành false khi component unmount
        };
    }, []);

    // --- Hàm tải dữ liệu ban đầu (ví dụ: danh sách địa điểm) ---
    const loadInitialData = useCallback(async () => {
        if (!isMountedRef.current) return;
        setIsLoadingInitialData(true); // Đổi tên state
        setInitialDataError(null);
        let token;

        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) {
                // Không nên throw error ở đây để finally vẫn chạy
                if (isMountedRef.current) {
                    Alert.alert("Lỗi", "Phiên làm việc không hợp lệ. Vui lòng đăng nhập lại.");
                    navigation.replace('Login');
                }
                return; // Dừng sớm
            }

            // Tải danh sách địa điểm
            const locRes = await fetch(`${BASE_URL}/api/locations`, { headers: { Authorization: `Bearer ${token}` } });
            if (!isMountedRef.current) return; // Kiểm tra sau mỗi await

            const locResultText = await locRes.text();
            if (!isMountedRef.current) return;

            let locResult;
            try {
                locResult = JSON.parse(locResultText);
            } catch (e) {
                throw new Error(`Lỗi parse JSON từ Locations API: ${locResultText.substring(0, 100)}`);
            }

            if (locRes.ok && (Array.isArray(locResult) || (locResult.success && Array.isArray(locResult.data)))) {
                const locations = Array.isArray(locResult) ? locResult : locResult.data;
                if (isMountedRef.current) {
                    setLocationsOptions(locations.map(loc => ({
                        label: String(loc.name || 'N/A') + (loc.building ? ` (${loc.building})` : ''),
                        value: loc._id
                    })));
                }
            } else {
                throw new Error(locResult?.message || "Không thể tải danh sách Cơ sở nhận.");
            }
        } catch (err) {
            console.error("Error loading initial data:", err);
            if (isMountedRef.current) {
                setInitialDataError(err.message || "Đã có lỗi xảy ra khi tải dữ liệu ban đầu.");
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoadingInitialData(false); // Đổi tên state
            }
        }
    }, [navigation]); // navigation là dependency

    // --- Effect gọi hàm tải dữ liệu ban đầu khi component mount ---
    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]); // Chỉ gọi một lần khi loadInitialData thay đổi (thường là không đổi)


    // --- Hàm xử lý khi nhấn nút Gửi Yêu Cầu ---
    const handleSubmit = useCallback(async () => {
        // Validation cơ bản
        if (!requestType) { Alert.alert('Thiếu thông tin', 'Vui lòng chọn Loại yêu cầu.'); return; }
        if (requestType === 'OTHER_REQUEST' && !requestTitle.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập Tiêu đề/Tên yêu cầu cho loại "Khác".'); return; }
        if (!studentNotes.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập Nội dung/Ghi chú chi tiết cho yêu cầu.'); return; }
        // Có thể thêm validation cho selectedReceivingCampusId nếu một số loại yêu cầu bắt buộc
        // Ví dụ: if (ACADEMIC_REQUEST_TYPES.find(t=>t.value === requestType)?.requiresCampus && !selectedReceivingCampusId) { ... }

        if (!isMountedRef.current) return;
        setIsSubmitting(true);
        let token;

        try {
            token = await AsyncStorage.getItem('userToken');
            if (!token) {
                throw new Error("Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại.");
            }

            // Nếu requestTitle không được nhập (và không phải OTHER_REQUEST) hoặc là OTHER_REQUEST nhưng rỗng,
            // tự động lấy 50 ký tự đầu của studentNotes làm tiêu đề.
            const finalRequestTitle = (requestType !== 'OTHER_REQUEST' && requestTitle.trim())
                ? requestTitle.trim()
                : (studentNotes.substring(0, 50) + (studentNotes.length > 50 ? '...' : ''));

            const dataToSend = {
                requestType: requestType,
                requestTitle: finalRequestTitle,
                studentNotes: studentNotes.trim(),
                receivingCampusId: selectedReceivingCampusId || undefined, // Gửi undefined nếu null để backend không lưu trường rỗng
                // quantity: quantity.trim() ? Number(quantity) : undefined, // Chỉ gửi nếu có giá trị và là số
            };
            console.log("Submitting Academic Request:", JSON.stringify(dataToSend, null, 2));

            const response = await fetch(`${BASE_URL}/api/academic-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(dataToSend)
            });

            if (!isMountedRef.current) return;
            const responseText = await response.text(); // Đọc response text trước
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error("Error parsing submit response:", responseText);
                throw new Error(`Lỗi phản hồi từ server (Status: ${response.status}). Vui lòng thử lại.`);
            }

            if (response.ok && result.success) {
                Alert.alert("Thành công", result.message || "Yêu cầu của bạn đã được gửi thành công!");
                navigation.goBack(); // Quay lại màn hình trước đó
            } else {
                throw new Error(result.message || `Gửi yêu cầu thất bại (Code: ${response.status})`);
            }
        } catch (err) {
            console.error("Error submitting academic request:", err);
            if (isMountedRef.current) {
                Alert.alert("Lỗi", err.message || "Không thể gửi yêu cầu. Vui lòng thử lại.");
            }
        } finally {
            if (isMountedRef.current) {
                setIsSubmitting(false);
            }
        }
    }, [navigation, requestType, requestTitle, studentNotes, selectedReceivingCampusId, quantity]); // Thêm quantity nếu dùng


    // --- Render Loading hoặc Error state ---
    if (isLoadingInitialData && !initialDataError) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centeredMessage}>
                    <ActivityIndicator size="large" color="#002366" />
                    <Text style={styles.loadingText}>Đang tải dữ liệu form...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (initialDataError && !isLoadingInitialData) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centeredMessage}>
                    <FontAwesome5 name="exclamation-triangle" size={40} color="#dc3545" style={{ marginBottom: 15 }} />
                    <Text style={styles.errorText}>{initialDataError}</Text>
                    <TouchableOpacity onPress={loadInitialData} style={styles.retryButton} disabled={isLoadingInitialData}>
                        <Text style={styles.retryButtonText}>Thử tải lại</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- Render Form ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoiding}
                // Điều chỉnh keyboardVerticalOffset nếu header của Khoa có chiều cao cố định
                keyboardVerticalOffset={Platform.OS === "ios" ? (navigation.canGoBack() ? 60 : 20) : 0}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled" // Cho phép chạm vào các nút trong ScrollView khi bàn phím mở
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.screenTitle}>Tạo Yêu Cầu Học Vụ Mới</Text>

                    <ModalPicker
                        label="Loại yêu cầu"
                        options={requestTypeOptions}
                        selectedValue={requestType}
                        onValueChange={setRequestType}
                        placeholder="-- Chọn loại giấy tờ/yêu cầu --"
                        required
                    />

                    <LabeledInput
                        label="Tiêu đề/Tên yêu cầu"
                        value={requestTitle}
                        onChangeText={setRequestTitle}
                        placeholder={requestType === 'OTHER_REQUEST' ? "Nhập tiêu đề yêu cầu của bạn" : "Tự động điền theo loại yêu cầu"}
                        required={requestType === 'OTHER_REQUEST'} // Chỉ bắt buộc khi loại là 'Khác'
                        editable={requestType === 'OTHER_REQUEST' || !requestType} // Cho phép sửa nếu là 'Khác' hoặc chưa chọn type
                    />

                    {/* Có thể ẩn/hiện các trường Số lượng, Thành tiền tùy theo requestType */}
                    {/* Ví dụ: if (requestType === 'SOME_TYPE_THAT_NEEDS_QUANTITY') { ... } */}
                    <LabeledInput
                        label="Số lượng"
                        value={quantity}
                        onChangeText={(text) => /^\d*$/.test(text) && setQuantity(text)} // Chỉ cho phép nhập số
                        keyboardType="numeric"
                        placeholder="1"
                        required // Xem xét có thực sự cần required không
                    />
                    {/* <LabeledInput label="Thành tiền" value={amountDisplay} editable={false} /> */}


                    <ModalPicker
                        label="Nơi nhận kết quả (Nếu có)"
                        options={locationsOptions}
                        selectedValue={selectedReceivingCampusId}
                        onValueChange={setSelectedReceivingCampusId}
                        placeholder="-- Chọn cơ sở/phòng ban --"
                        isLoading={isLoadingInitialData} // Dùng isLoadingInitialData
                    />

                    <LabeledInput
                        label="Nội dung chi tiết yêu cầu"
                        value={studentNotes}
                        onChangeText={setStudentNotes}
                        placeholder="Ghi rõ nội dung đề nghị, lý do, hoặc các thông tin cần thiết khác..."
                        multiline
                        numberOfLines={5} // Tăng số dòng cho dễ nhập
                        required
                    />

                    <TouchableOpacity
                        style={[styles.submitButton, (isSubmitting || isLoadingInitialData) && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isSubmitting || isLoadingInitialData}
                    >
                        {isSubmitting
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.submitButtonText}>Gửi Yêu Cầu</Text>}
                    </TouchableOpacity>

                    {/* Thêm khoảng đệm dưới cùng để không bị che bởi bàn phím hoặc tab bar */}
                    <View style={{ height: Platform.OS === 'ios' ? 100 : 60 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f2f5' },
    keyboardAvoiding: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    screenTitle: { fontSize: 22, fontWeight: '700', color: '#002366', textAlign: 'center', marginBottom: 25 },
    inputGroup:{ marginBottom: 18 }, // Giảm margin một chút
    label:{ fontSize: 15, fontWeight: '600', color: '#495057', marginBottom: 7 },
    requiredStar: { color: '#dc3545'},
    input:{
        backgroundColor: '#fff', // Nền trắng cho input
        borderWidth: 1,
        borderColor: '#ced4da', // Màu border chuẩn hơn
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 14 : 11, // Điều chỉnh padding
        fontSize: 16,
        color: '#343a40', // Màu chữ đậm hơn
        minHeight: 48,
    },
    disabledInput:{ backgroundColor: '#e9ecef', color: '#6c757d' },
    multilineInput:{ paddingTop: 14, minHeight: 120, textAlignVertical: 'top' }, // Tăng minHeight
    pickerTrigger:{
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#ced4da', borderRadius: 8,
        paddingHorizontal: 15, paddingVertical: 14, minHeight: 48,
        flexDirection:'row', justifyContent:'space-between', alignItems:'center'
    },
    pickerTriggerText:{ fontSize: 16, color: '#343a40', flex:1, marginRight:5 },
    pickerPlaceholder:{ fontSize: 16, color: '#6c757d' },
    pickerIcon:{ marginLeft: 10, color: '#6c757d' }, // Màu icon nhạt hơn
    modalOverlay:{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.6)' }, // Nền mờ đậm hơn
    modalContentContainer:{
        backgroundColor:'#ffffff',
        borderTopLeftRadius:18, borderTopRightRadius:18, // Bo góc lớn hơn
        paddingBottom: Platform.OS === 'ios' ? 35 : 25,
        maxHeight: Platform.OS === 'ios' ? '45%' : '55%', // Điều chỉnh chiều cao
    },
    modalHeader:{
        flexDirection:'row', justifyContent:'space-between', alignItems:'center',
        paddingVertical:12, paddingHorizontal:18,
        borderBottomWidth:1, borderBottomColor:'#e0e0e0' // Màu border nhạt hơn
    },
    modalTitle:{ fontSize:17, fontWeight:'600', color:'#002366' },
    modalHeaderButton: {paddingVertical:8, paddingHorizontal: 12},
    modalButtonTextAction:{ fontSize:17, color:'#007aff' },
    modalButtonDone:{ fontWeight:'bold', color: '#003974' }, // Màu HSU đậm
    modalPicker:{ width:'100%', backgroundColor: Platform.OS === 'ios' ? 'transparent': undefined },
    pickerItemTextIOS:{ color:'#000', fontSize:18, height: Platform.OS === 'ios' ? 160 : undefined }, // Chỉnh height
    pickerPlaceholderItemIOS:{ color: '#888', fontSize:18 }, // Đổi tên cho rõ iOS
    noOptionsContainer: { padding: 25, alignItems: 'center', justifyContent: 'center', height: 120 },
    noOptionsText: { fontSize: 16, color: '#6c757d', fontStyle: 'italic' },
    submitButton:{
        backgroundColor:'#003974', // Màu xanh HSU đậm
        paddingVertical: 15, borderRadius: 10, // Bo góc lớn hơn
        alignItems:'center', marginTop:30, // Tăng marginTop
        shadowColor: "#000", shadowOffset: { width: 0, height: 3, }, // Shadow rõ hơn
        shadowOpacity: 0.15, shadowRadius: 5, elevation: 4,
    },
    submitButtonDisabled:{ backgroundColor:'#b0c4de', elevation: 0, shadowOpacity: 0 }, // Màu disabled nhạt hơn
    submitButtonText:{ color:'#fff', fontSize:16, fontWeight:'bold' }, // Giảm size chút
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f0f2f5' },
    loadingText: { marginTop:12, color:'#495057', fontSize:16 },
    errorText: { color: '#c0392b', fontSize: 16, textAlign: 'center', marginBottom: 12, fontWeight:'500' },
    retryButton: { marginTop: 18, paddingHorizontal: 25, paddingVertical: 12, backgroundColor: '#0056b3', borderRadius: 8 },
    retryButtonText: { color: '#fff', fontWeight:'bold', fontSize: 15 },
});

export default AcademicRequestFormScreen;
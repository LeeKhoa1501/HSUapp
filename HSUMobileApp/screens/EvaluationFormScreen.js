// screens/EvaluationFormScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {View, Text, TextInput, ScrollView, StyleSheet,ActivityIndicator, Alert, TouchableOpacity, Modal,Platform,  KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper'; // PaperProvider cần nếu dùng component Paper khác
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios'; // Có thể dùng nếu muốn

// <<< THAY BẰNG BASE URL CỦA ANH >>>
const BASE_URL = 'http://10.101.38.213:5000'; // Hoặc lấy từ file config

// --- Component Rating Question ---
const RatingQuestion = React.memo(({ question, ratingValue, onRatingChange }) => (
    <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{question.questionText}</Text>
        <View style={styles.ratingGroup}>
            {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = ratingValue === value;
                return (
                    <TouchableOpacity
                        key={value}
                        style={[ styles.ratingNumberButton, isSelected && styles.ratingNumberButtonSelected ]}
                        onPress={() => onRatingChange(question.questionId, value)}
                        accessibilityLabel={`Đánh giá ${value} sao`} // Thêm accessibility
                    >
                        <Text style={[ styles.ratingNumberLabel, isSelected && styles.ratingNumberLabelSelected ]}>
                            {value}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
));

// --- Component EvaluationFormScreen ---
const EvaluationFormScreen = ({ route, navigation }) => {
    // Lấy thông tin môn học từ navigation params
    const { courseId, courseCode, courseName, semester, academicYear, instructorName } = route.params || {};
    const isMountedRef = useRef(true); // Ref kiểm tra component còn mount không

    // States
    const [questions, setQuestions] = useState([]); // Danh sách câu hỏi từ API
    const [answers, setAnswers] = useState({}); // Lưu câu trả lời: { questionId: { rating: X, comment: Y } }
    const [generalComment, setGeneralComment] = useState(''); // Bình luận chung
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(true); // Loading khi fetch câu hỏi
    const [isSubmitting, setIsSubmitting] = useState(false); // Loading khi nộp bài
    const [error, setError] = useState(null); // Lỗi fetch/submit

    // Fetch bộ câu hỏi khi component mount
    useEffect(() => {
        isMountedRef.current = true;
        const fetchQuestions = async () => {
            if (!isMountedRef.current) return;
            console.log("[EvalForm] Fetching questions...");
            setIsLoadingQuestions(true); setError(null);
            let token;
            try {
                token = await AsyncStorage.getItem('userToken');
                if (!token) throw new Error("Token không hợp lệ. Vui lòng đăng nhập lại.");

                const response = await fetch(`${BASE_URL}/api/evaluations/questions`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!isMountedRef.current) return;

                const responseText = await response.text();
                let result;
                try { result = JSON.parse(responseText); }
                catch (e) { throw new Error(`Lỗi parse JSON câu hỏi: ${responseText}`); }

                console.log(`[EvalForm] Questions API Status: ${response.status}, Success: ${result?.success}`);

                if (response.ok && result.success && Array.isArray(result.data)) {
                    if (isMountedRef.current) {
                        setQuestions(result.data);
                        // Khởi tạo state answers
                        const initialAnswers = {};
                        result.data.forEach(q => { initialAnswers[q.questionId] = { rating: null, comment: '' }; });
                        setAnswers(initialAnswers);
                        console.log("[EvalForm] Questions loaded.");
                    }
                } else {
                    throw new Error(result.message || "Không thể tải câu hỏi đánh giá.");
                }
            } catch (err) {
                console.error("[EvalForm] Fetch Questions Error:", err);
                if (isMountedRef.current) setError(err.message || "Lỗi tải câu hỏi.");
                // Xử lý lỗi token
                if (String(err.message).includes('Token')) {
                    Alert.alert("Lỗi", "Phiên đăng nhập hết hạn.", [{ text: "OK", onPress: () => navigation.replace('Login') }]);
                }
            } finally {
                if (isMountedRef.current) setIsLoadingQuestions(false);
            }
        };
        fetchQuestions();
        // Cleanup function để set isMountedRef thành false khi unmount
        return () => { isMountedRef.current = false; };
    }, [navigation]); // Thêm navigation vào dependency array

    // Callbacks cập nhật state answers
    const handleRatingChange = useCallback((questionId, rating) => {
        setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), rating } }));
    }, []);
    // const handleCommentChange = useCallback((questionId, comment) => { ... }, []); // Hiện không dùng comment riêng

    // Xử lý Nộp bài đánh giá
    const handleSubmit = async () => {
        console.log("[EvalForm] Attempting submission...");
        // --- Validate ---
        let isMissingRating = false;
        const formattedAnswers = questions
            .map(q => {
                const answerData = answers[q.questionId];
                if (q.type === 'rating' && (answerData?.rating == null)) { isMissingRating = true; }
                return { questionId: q.questionId, questionText: q.questionText, rating: answerData?.rating, comment: answerData?.comment?.trim() || '' };
            });
        const ratingQuestionsCount = questions.filter(q => q.type === 'rating').length;
        const answeredRatingCount = formattedAnswers.filter(a => a.rating != null).length;
        if (answeredRatingCount < ratingQuestionsCount || isMissingRating) { return Alert.alert("Thiếu thông tin", "Vui lòng đánh giá đầy đủ các tiêu chí điểm số (chọn từ 1 đến 5)."); }

        setIsSubmitting(true); setError(null);
        let token;
        try {
            token = await AsyncStorage.getItem('userToken'); if (!token) throw new Error("Token không hợp lệ.");
            const submissionData = { courseId, semester, academicYear, instructorName: instructorName || "N/A", answers: formattedAnswers, generalComment: generalComment.trim() };
            console.log("[EvalForm] Submitting data:", JSON.stringify(submissionData, null, 2));

            const response = await fetch(`${BASE_URL}/api/evaluations`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(submissionData) });
            const responseText = await response.text(); console.log("[EvalForm] Submit Raw Response:", responseText); let result; try { result = JSON.parse(responseText); } catch (e) { throw new Error(`Lỗi parse JSON submit: ${responseText}`); }
            if (response.ok && result.success) { Alert.alert("Thành công", result.message || "Đã gửi đánh giá!"); navigation.goBack(); }
            else { throw new Error(result.message || `Gửi thất bại (Status: ${response.status})`); }
        } catch (err) { console.error("[EvalForm] Submit Error:", err); setError(err.message || "Lỗi gửi đánh giá."); Alert.alert("Lỗi", err.message || "Không thể gửi."); } // Sử dụng error.message
        finally { if(isMountedRef.current) setIsSubmitting(false); }
    };

    // --- Render ---
    if (isLoadingQuestions) { return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><ActivityIndicator size="large" color="#003366" /></View></SafeAreaView>; }
    if (error && !isLoadingQuestions) { return <SafeAreaView style={styles.safeArea}><View style={styles.centeredMessage}><Text style={styles.errorText}>{error}</Text>{/* Thêm nút thử lại nếu muốn */}</View></SafeAreaView>; }

    return (
        <PaperProvider>
            <SafeAreaView style={styles.safeArea}>
                {/* <<< BỌC BẰNG KeyboardAvoidingView >>> */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"} // Behavior tùy platform
                    style={styles.keyboardAvoiding}                      // Style flex: 1
                    keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0} // Điều chỉnh nếu có header che
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent} // <<< Cần flexGrow: 1
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Thông tin môn học */}
                        <View style={styles.courseHeader}>
                           <Text style={styles.courseHeaderText} numberOfLines={2}>{courseName || 'N/A'}</Text>
                           <Text style={styles.courseHeaderSubText}>{courseCode || 'N/A'} - {semester} ({academicYear})</Text>
                           {instructorName && <Text style={styles.courseHeaderSubText}>Giảng viên: {instructorName}</Text>}
                        </View>

                        {/* Danh sách câu hỏi Rating */}
                        {questions.filter(q => q.type === 'rating').map((q) => {
                            const answerData = answers[q.questionId];
                            return ( <RatingQuestion key={q.questionId} question={q} ratingValue={answerData?.rating} onRatingChange={handleRatingChange} /> );
                        })}

                        {/* Ô Bình luận chung */}
                         <View style={styles.questionContainer}>
                            <Text style={styles.questionText}>Góp ý chung / Góp ý khác:</Text>
                            <TextInput
                                style={styles.commentInput}
                                value={generalComment}
                                onChangeText={setGeneralComment}
                                placeholder="Nhập góp ý của bạn ở đây..."
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                                returnKeyType="done"
                                blurOnSubmit={true} // Tự ẩn bàn phím khi bấm done
                            />
                        </View>

                        {/* Nút Nộp */}
                        <TouchableOpacity
                             style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                             onPress={handleSubmit}
                             disabled={isSubmitting}
                         >
                            {isSubmitting ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.submitButtonText}>Gửi đánh giá</Text>}
                        </TouchableOpacity>

                        {/* Thêm khoảng trống dưới cùng để không bị sát bàn phím */}
                        <View style={{ height: 50 }} />

                    </ScrollView>
                 </KeyboardAvoidingView>
            </SafeAreaView>
        </PaperProvider>
    );
};

// --- StyleSheet ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
    keyboardAvoiding: { flex: 1 }, // <<< Cho phép KAV co giãn
    scrollView: { flex: 1 },       // <<< ScrollView cũng co giãn
    scrollContent: {               // <<< Quan trọng để đẩy nội dung lên
        padding: 15,
        paddingBottom: 40,
        flexGrow: 1
    },
    centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center' },
    courseHeader: { marginBottom: 25, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    courseHeaderText: { fontSize: 18, fontWeight: 'bold', color: '#003366', textAlign: 'center', marginBottom: 5 },
    courseHeaderSubText: { fontSize: 14, color: '#6c757d', textAlign: 'center' },
    questionContainer: { marginBottom: 25 },
    questionText: { fontSize: 16, fontWeight: '500', color: '#34495e', marginBottom: 15 },
    ratingGroup: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 5, },
    ratingNumberButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ced4da', backgroundColor: '#f8f9fa', marginHorizontal: 3, },
    ratingNumberButtonSelected: { backgroundColor: '#007bff', borderColor: '#0056b3', },
    ratingNumberLabel: { fontSize: 16, fontWeight: 'bold', color: '#495057', },
    ratingNumberLabelSelected: { color: '#ffffff', },
    commentInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 100, color: '#212529', marginTop: 0 },
    submitButton: { backgroundColor: '#002366', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 15 },
    submitButtonDisabled: { backgroundColor: '#adb5bd' },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default EvaluationFormScreen;
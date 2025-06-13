// HSUMobileApp/screens/PhotoAccountScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, RefreshControl, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import vi from 'date-fns/locale/vi';

// ANH NHỚ THAY BẰNG IP VÀ PORT ĐÚNG CỦA BACKEND SERVER
const BASE_URL = 'http://10.101.39.47:5000';

// Hàm format số tiền cho đẹp
const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return '0 đ';
    return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

const PhotoAccountScreen = () => {
    const navigation = useNavigation();
    const [accountInfo, setAccountInfo] = useState(null); // { userName, studentId, balance, _id }
    const [transactions, setTransactions] = useState([]);
    const [isLoadingInfo, setIsLoadingInfo] = useState(true);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // State cho pagination lịch sử giao dịch (nếu cần)
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchData = useCallback(async (isRefreshing = false, loadMore = false) => {
        if (!isRefreshing && !loadMore) {
            setIsLoadingInfo(true);
            setIsLoadingTransactions(true);
        }
        setError(null);

        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                throw new Error("Chưa đăng nhập hoặc token không hợp lệ.");
            }

            // Fetch thông tin tài khoản
            if (!loadMore) { // Chỉ fetch info khi load lần đầu hoặc refresh
                const accountResponse = await fetch(`${BASE_URL}/api/photo-account/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const accountResult = await accountResponse.json();
                if (accountResponse.ok && accountResult.success) {
                    setAccountInfo(accountResult.data);
                } else {
                    throw new Error(accountResult.message || 'Không thể tải thông tin tài khoản photo.');
                }
            }

            // Fetch lịch sử giao dịch
            const pageToFetch = loadMore ? currentPage + 1 : 1;
            const transactionsResponse = await fetch(`${BASE_URL}/api/photo-account/me/transactions?pageNumber=${pageToFetch}&pageSize=15`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const transactionsResult = await transactionsResponse.json();
            if (transactionsResponse.ok && transactionsResult.success) {
                if (loadMore) {
                    setTransactions(prev => [...prev, ...transactionsResult.data]);
                } else {
                    setTransactions(transactionsResult.data);
                }
                setCurrentPage(transactionsResult.page);
                setTotalPages(transactionsResult.pages);
            } else {
                throw new Error(transactionsResult.message || 'Không thể tải lịch sử giao dịch.');
            }

        } catch (err) {
            setError(err.message);
            // Nếu lỗi token, có thể điều hướng về Login
            if (err.message.includes("token")) {
                navigation.replace('Login');
            }
        } finally {
            if (!isRefreshing && !loadMore) {
                setIsLoadingInfo(false);
                setIsLoadingTransactions(false);
            }
            if (isRefreshing) setRefreshing(false);
            if (loadMore) setIsLoadingMore(false);
        }
    }, [navigation, currentPage]); // Thêm currentPage vào dependency nếu dùng loadMore

    // Load dữ liệu khi màn hình được focus hoặc mount lần đầu
    useFocusEffect(
        useCallback(() => {
            setCurrentPage(1); // Reset page khi focus lại
            fetchData();
        }, [fetchData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        setCurrentPage(1); // Reset page khi refresh
        fetchData(true);
    };

    const handleLoadMore = () => {
        if (!isLoadingMore && currentPage < totalPages) {
            setIsLoadingMore(true);
            fetchData(false, true);
        }
    };

    const renderTransactionItem = ({ item }) => (
        <View style={styles.transactionItem}>
            <View style={styles.transactionIconContainer}>
                <FontAwesome5
                    name={item.type === 'DEPOSIT_AUTO' || item.type === 'DEPOSIT_MANUAL' ? 'plus-circle' : 'minus-circle'}
                    size={20}
                    color={item.type === 'DEPOSIT_AUTO' || item.type === 'DEPOSIT_MANUAL' ? '#27ae60' : '#e74c3c'} // Xanh lá cho nạp, đỏ cho trừ
                />
            </View>
            <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.transactionDate}>
                    {format(parseISO(item.transactionDate), 'HH:mm - EEEE, dd/MM/yyyy', { locale: vi })}
                </Text>
                {item.pages && <Text style={styles.transactionPages}>Số trang: {item.pages}</Text>}
            </View>
            <Text style={[
                styles.transactionAmount,
                (item.type === 'DEPOSIT_AUTO' || item.type === 'DEPOSIT_MANUAL') ? styles.amountDeposit : styles.amountWithdraw
            ]}>
                {(item.type === 'DEPOSIT_AUTO' || item.type === 'DEPOSIT_MANUAL' || item.amount > 0) ? '+' : ''}{formatCurrency(item.amount)}
            </Text>
        </View>
    );

    const ListHeader = () => (
        <View style={styles.headerContainer}>
            {isLoadingInfo ? (
                <ActivityIndicator color="#002366" style={{ marginVertical: 20 }} />
            ) : accountInfo ? (
                <>
                    <Text style={styles.accountName}>{accountInfo.userName || 'N/A'}</Text>
                    {accountInfo.studentId && <Text style={styles.studentId}>MSSV: {accountInfo.studentId}</Text>}
                    <View style={styles.balanceContainer}>
                        <Text style={styles.balanceLabel}>Số dư hiện tại:</Text>
                        <Text style={styles.balanceAmount}>{formatCurrency(accountInfo.balance)}</Text>
                    </View>
                    {/* Có thể thêm nút Nạp tiền ở đây */}
                    {/* <TouchableOpacity style={styles.depositButton} onPress={() => Alert.alert("Nạp tiền", "Vui lòng liên hệ quầy dịch vụ sinh viên để nạp tiền vào tài khoản photo.")}>
                        <FontAwesome5 name="wallet" size={16} color="#fff" />
                        <Text style={styles.depositButtonText}>Nạp tiền</Text>
                    </TouchableOpacity> */}
                </>
            ) : (
                <Text style={styles.infoErrorText}>Không tải được thông tin tài khoản.</Text>
            )}
            <Text style={styles.transactionListTitle}>Lịch sử giao dịch</Text>
        </View>
    );

    if (error && !accountInfo && transactions.length === 0) { // Lỗi nghiêm trọng ban đầu
        return (
            <SafeAreaView style={styles.centered}>
                <FontAwesome5 name="exclamation-circle" size={40} color="#c0392b" style={{marginBottom: 15}}/>
                <Text style={styles.errorTextCritical}>Lỗi: {error}</Text>
                <TouchableOpacity onPress={() => fetchData()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <FlatList
                data={transactions}
                renderItem={renderTransactionItem}
                keyExtractor={(item) => item._id.toString()}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={ // Hiển thị khi không có giao dịch (và không loading)
                    !isLoadingTransactions && !error ? (
                        <View style={styles.emptyContainer}>
                            <FontAwesome5 name="file-invoice-dollar" size={50} color="#bdc3c7" />
                            <Text style={styles.emptyText}>Chưa có giao dịch nào.</Text>
                        </View>
                    ) : null // Để ActivityIndicator của ListHeaderComponent hiển thị nếu chỉ transactions đang load
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#002366"]} />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    isLoadingMore ? <ActivityIndicator size="small" color="#002366" style={{ marginVertical: 20 }} /> : null
                }
                contentContainerStyle={styles.listContentContainer}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f4f7f9' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorTextCritical: { color: '#c0392b', fontSize: 16, textAlign: 'center', fontWeight: '500' },
    retryButton: { backgroundColor: '#002366', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, marginTop: 20 },
    retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    headerContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        alignItems: 'center', // Căn giữa tên và số dư
    },
    accountName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#002366', // Màu HSU
        marginBottom: 4,
    },
    studentId: {
        fontSize: 14,
        color: '#555',
        marginBottom: 15,
    },
    balanceContainer: {
        backgroundColor: '#e7f0ff', // Nền xanh nhạt
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    balanceLabel: {
        fontSize: 15,
        color: '#003974',
        marginBottom: 5,
    },
    balanceAmount: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#0056b3', // Xanh đậm hơn
    },
    // depositButton: { ... },
    // depositButtonText: { ... },
    infoErrorText: {
        color: '#c0392b',
        fontStyle: 'italic',
        textAlign: 'center',
        marginVertical: 15,
    },
    transactionListTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginTop: 10, // Khoảng cách với phần số dư
        marginBottom: 15,
        alignSelf: 'flex-start', // Căn trái tiêu đề list
    },
    listContentContainer: {
        paddingBottom: 20,
    },
    transactionItem: {
        backgroundColor: '#fff',
        padding: 15,
        marginHorizontal: 15,
        marginBottom: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
    },
    transactionIconContainer: {
        marginRight: 15,
        width: 30, // Để icon căn giữa
        alignItems:'center',
    },
    transactionDetails: {
        flex: 1,
    },
    transactionDescription: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
    },
    transactionDate: {
        fontSize: 11,
        color: '#777',
    },
    transactionPages: {
        fontSize: 11,
        color: '#777',
        fontStyle: 'italic',
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 10, // Khoảng cách với phần details
    },
    amountDeposit: { // Màu cho số tiền nạp
        color: '#27ae60', // Xanh lá
    },
    amountWithdraw: { // Màu cho số tiền trừ
        color: '#e74c3c', // Đỏ
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        color: '#6c757d',
    },
});

export default PhotoAccountScreen;
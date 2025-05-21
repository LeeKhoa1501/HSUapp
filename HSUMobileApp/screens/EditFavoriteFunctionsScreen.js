// screens/EditFavoriteFunctionsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

const MAX_FAVORITES = 8; // Giới hạn số lượng chức năng ưa thích
const NUM_COLUMNS = 4; // Số cột cho grid
const screenWidth = Dimensions.get('window').width;
const itemSize = (screenWidth - 20 * 2 - (NUM_COLUMNS - 1) * 10) / NUM_COLUMNS; // 20 là padding ngang, 10 là margin giữa item

const EditFavoriteFunctionsScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();

    // Lấy allFunctions và currentFavoriteIds từ params khi navigate đến màn hình này
    const { allFunctions: initialAllFunctions = [], currentFavoriteIds: initialFavoriteIds = [] } = route.params || {};

    const [allAppFunctions] = useState(initialAllFunctions);
    // Dùng Set để dễ dàng kiểm tra và thêm/xóa ID
    const [selectedFavoriteIds, setSelectedFavoriteIds] = useState(new Set(initialFavoriteIds));

    const toggleFavorite = (funcId) => {
        setSelectedFavoriteIds(prevIds => {
            const newIds = new Set(prevIds);
            if (newIds.has(funcId)) {
                newIds.delete(funcId);
            } else {
                if (newIds.size < MAX_FAVORITES) {
                    newIds.add(funcId);
                } else {
                    Alert.alert("Giới hạn", `Bạn chỉ có thể chọn tối đa ${MAX_FAVORITES} chức năng ưa thích.`);
                }
            }
            return newIds;
        });
    };

    const handleSaveChanges = async () => {
        try {
            const idsArray = Array.from(selectedFavoriteIds);
            await AsyncStorage.setItem('favoriteFunctionIds', JSON.stringify(idsArray));
            Alert.alert("Thành công", "Đã cập nhật danh sách ưa thích!");
            if (navigation.canGoBack()) {
                navigation.goBack(); // Quay lại HomeScreen, useFocusEffect trên HomeScreen sẽ load lại
            }
        } catch (e) {
            console.error("Error saving favorite functions:", e);
            Alert.alert("Lỗi", "Không thể lưu thay đổi. Vui lòng thử lại.");
        }
    };

    // Cập nhật title của header để hiển thị số lượng đã chọn
    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={handleSaveChanges} style={{ marginRight: 15 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                        Lưu ({selectedFavoriteIds.size}/{MAX_FAVORITES})
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, selectedFavoriteIds, handleSaveChanges]);


    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.infoText}>
                    Chọn các chức năng bạn muốn hiển thị ở mục "Truy cập nhanh".
                    Chạm để chọn hoặc bỏ chọn.
                </Text>
                <View style={styles.gridContainer}>
                    {allAppFunctions.map((func) => {
                        const isSelected = selectedFavoriteIds.has(func.id);
                        return (
                            <TouchableOpacity
                                key={func.id.toString()}
                                style={[
                                    styles.gridItem,
                                    isSelected && styles.gridItemSelected // Style khi được chọn
                                ]}
                                onPress={() => toggleFavorite(func.id)}
                            >
                                <View style={[
                                    styles.iconContainer,
                                    isSelected && styles.iconContainerSelected
                                ]}>
                                    <FontAwesome5
                                        name={func.icon}
                                        size={itemSize * 0.35}
                                        color={isSelected ? '#0056b3' : (func.iconColor || '#333')}
                                    />
                                    {isSelected && ( // Hiển thị dấu tick nếu được chọn
                                        <View style={styles.selectedTick}>
                                            <FontAwesome5 name="check" size={10} color="#fff" />
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.itemName, isSelected && styles.itemNameSelected]} numberOfLines={2}>
                                    {func.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F0F4F8' }, // Màu nền nhạt
    container: {
        padding: 20, // Padding chung
    },
    infoText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between', // Để các item căn đều nếu không đủ 1 hàng
    },
    gridItem: {
        width: itemSize,
        alignItems: 'center',
        marginBottom: 20, // Khoảng cách giữa các hàng
        paddingVertical: 10,
        paddingHorizontal: 5,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    gridItemSelected: {
        borderColor: '#0056b3', // Border màu xanh khi được chọn
        backgroundColor: '#e7f0ff', // Nền nhạt hơn khi được chọn
    },
    iconContainer: {
        width: itemSize * 0.6,
        height: itemSize * 0.6,
        borderRadius: (itemSize * 0.6) / 2, // Bo tròn
        backgroundColor: '#f0f0f0', // Nền icon mặc định
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        position: 'relative', // Để định vị dấu tick
    },
    iconContainerSelected: {
        backgroundColor: '#fff', // Nền icon khi được chọn (có thể là màu khác)
    },
    selectedTick: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#0056b3', // Màu nền dấu tick
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fff'
    },
    itemName: {
        fontSize: 11,
        color: '#333',
        textAlign: 'center',
        fontWeight: '500',
    },
    itemNameSelected: {
        color: '#0056b3', // Màu chữ khi được chọn
    },
});

export default EditFavoriteFunctionsScreen;
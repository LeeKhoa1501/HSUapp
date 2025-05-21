// components/FavoriteFunctions.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;
const favoriteItemSize = (screenWidth - 40 - 3 * 10) / 4; // 40 là padding ngang tổng, 10 là margin giữa các item

const FavoriteFunctions = ({ title, functions, onFunctionPress }) => {
    if (!functions || functions.length === 0) {
        return null; // Không render gì nếu không có functions
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
            >
                {functions.map((func) => (
                    <TouchableOpacity
                        key={func.id.toString()}
                        style={styles.item}
                        onPress={() => onFunctionPress(func)}
                    >
                        <View style={styles.iconContainer}>
                            <FontAwesome5 name={func.icon} size={favoriteItemSize * 0.45} color={func.iconColor || "#0056b3"} />
                        </View>
                        <Text style={styles.itemText} numberOfLines={2}>{func.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 12,
    },
    scrollContainer: {
        paddingRight: 10, // Để item cuối không bị sát mép
    },
    item: {
        width: favoriteItemSize,
        alignItems: 'center',
        marginRight: 10, // Khoảng cách giữa các item
        paddingVertical: 10,
    },
    iconContainer: {
        width: favoriteItemSize * 0.7, // Icon nhỏ hơn item một chút
        height: favoriteItemSize * 0.7,
        borderRadius: (favoriteItemSize * 0.7) / 2, // Bo tròn
        backgroundColor: '#e7f0ff', // Màu nền nhẹ cho icon
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemText: {
        fontSize: 11,
        color: '#495057',
        textAlign: 'center',
    }
});
export default React.memo(FavoriteFunctions);
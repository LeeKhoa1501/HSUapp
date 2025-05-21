// components/HomeScreenHeader.js
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons'; // Cho icon default

const HomeScreenHeader = ({ studentName, studentMSSV, avatarUrl, onAvatarPress }) => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Chào buổi sáng";
        if (hour < 18) return "Chào buổi chiều";
        return "Chào buổi tối";
    };

    return (
        <View style={styles.headerContainer}>
            <View style={styles.userInfo}>
                <Text style={styles.greetingText}>{getGreeting()},</Text>
                <Text style={styles.studentNameText} numberOfLines={1}>{studentName || 'Sinh viên'}</Text>
                {studentMSSV && <Text style={styles.mssvText}>MSSV: {studentMSSV}</Text>}
            </View>
            <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                    // Icon default nếu không có avatar
                    <View style={styles.defaultAvatar}>
                        <FontAwesome5 name="user-graduate" size={24} color="#002366" />
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff', // Hoặc màu chủ đạo
        // borderBottomWidth: 1,
        // borderBottomColor: '#eee',
    },
    userInfo: {
        flex: 1, // Cho phép text co giãn
        marginRight: 15,
    },
    greetingText: {
        fontSize: 16,
        color: '#6c757d',
    },
    studentNameText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#002366', // Màu HSU
        marginTop: 2,
    },
    mssvText: {
        fontSize: 13,
        color: '#495057',
        marginTop: 2,
    },
    avatarContainer: {
        // Style cho container của avatar để dễ canh chỉnh
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25, // Bo tròn
        borderWidth: 1,
        borderColor: '#002366'
    },
    defaultAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#e9ecef',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ced4da'
    }
});

export default React.memo(HomeScreenHeader);
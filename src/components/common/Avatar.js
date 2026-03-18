import React, { useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import theme from '../../styles/theme';

const Avatar = ({ source, name, size = 60 }) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const renderContent = () => {
    if (source && !imageError) {
      return (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => setImageError(true)}
        />
      );
    }

    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
          {getInitials(name)}
        </Text>
      </View>
    );
  };

  return <View style={styles.container}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: theme.colors.surface,
    fontWeight: 'bold',
  },
});

export default Avatar;

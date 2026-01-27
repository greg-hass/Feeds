import { useWindowDimensions } from 'react-native';
import { UI } from '@/config/constants';

/**
 * Hook to detect if the current viewport is desktop size
 * @returns boolean indicating if viewport width >= desktop breakpoint
 */
export const useIsDesktop = (): boolean => {
    const { width } = useWindowDimensions();
    return width >= UI.DESKTOP_BREAKPOINT;
};

/**
 * Hook to detect if the current viewport is mobile size
 * @returns boolean indicating if viewport width < mobile breakpoint
 */
export const useIsMobile = (): boolean => {
    const { width } = useWindowDimensions();
    return width < UI.MOBILE_BREAKPOINT;
};

/**
 * Hook to get current breakpoint information
 * @returns object with isDesktop, isMobile, and isTablet booleans
 */
export const useBreakpoint = () => {
    const { width } = useWindowDimensions();
    
    return {
        isDesktop: width >= UI.DESKTOP_BREAKPOINT,
        isTablet: width >= UI.MOBILE_BREAKPOINT && width < UI.DESKTOP_BREAKPOINT,
        isMobile: width < UI.MOBILE_BREAKPOINT,
        width,
    };
};

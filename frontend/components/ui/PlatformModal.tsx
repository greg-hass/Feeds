import React, { ReactNode } from "react";
import { Modal, ModalProps, Platform } from "react-native";

type PlatformModalProps = Omit<ModalProps, "children"> & {
  children: ReactNode;
};

export function PlatformModal({ visible, children, ...modalProps }: PlatformModalProps) {
  if (Platform.OS === "web") {
    return visible ? <>{children}</> : null;
  }

  return (
    <Modal visible={visible} {...modalProps}>
      {children}
    </Modal>
  );
}

import React from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLanguage } from '../../hooks/useLanguage.js';

// Module-level toast utilities
export const notifySuccess = (message) => toast.success(message, {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
});

export const notifyError = (message) => toast.error(message, {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
});

export const notifyInfo = (message) => toast.info(message, {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
});

export { toast };

function TpToastContainer() {
  const { isUrdu } = useLanguage();
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={true}
      newestOnTop
      closeOnClick
      rtl={isUrdu}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
      transition={Slide}
      className="tp-toast-host"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '400px',
        zIndex: 11000
      }}
      toastClassName="tp-toast"
    />
  );
}

// ToastContainer wrapper (required for rendering)
export const ToastProvider = ({ children }) => (
  <>
    {children}
    <TpToastContainer />
  </>
);


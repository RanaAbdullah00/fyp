import React from 'react';

// Simple footer that stays above mobile bottom navigation.
const Footer = () => (
  <footer className="bg-white border-top py-2 small text-muted text-center d-none d-md-block">
    © {new Date().getFullYear()} TransPak · Digital Freight Exchange
  </footer>
);

export default Footer;


class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.0"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-macos-x64"
      sha256 "37aee4f5a3ce9952aa18d22ab1bc2d1f275d3a37c969a76288cdc221158ff21b"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-macos-arm64"
      sha256 "ab348d88ad424d707fb9b4e2acf2774f62efc75040bbc358739ac3f12f72ea8d"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-linux-x64"
      sha256 "2f8c95bcb0e56c0e2f77a66ee077294be257479cd44cb09815c6050d6f5138ee"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-linux-arm64"
      sha256 "84cad3261ecad045a66f3f2e05064113d41250c2124ad5e3017baaa5bd5cfbdc"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end

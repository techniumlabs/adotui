class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.0"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-macos-x64"
      sha256 "ac4372c68e628d1b437dc977952a98b03bc6b7d1350f81e825e7d0c3871389e3"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-macos-arm64"
      sha256 "aa56b1ad16d1ec8d4d8b97147541da337a4f996951f279cccb1fa757a73287fd"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-linux-x64"
      sha256 "f27220c5978168c80d838e24f547243d175e3241b3bf62d33d14391a8c89a2a4"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.0/adotui-linux-arm64"
      sha256 "2aabfdaa89c70334f3dd01f35a41350fcc1818426feaba2ef9ad350e119cfb77"
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
